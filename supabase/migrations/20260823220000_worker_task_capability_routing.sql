begin;

create or replace function public.claim_clip_task_for_capabilities(
  p_worker_id text,
  p_lease_seconds integer default 120,
  p_include_task_types text[] default null,
  p_exclude_task_types text[] default '{}'::text[]
)
returns setof public.job_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.job_tasks%rowtype;
  v_message record;
begin
  if nullif(btrim(p_worker_id), '') is null then
    raise exception 'worker id is required' using errcode = '22023';
  end if;

  perform public.dispatch_clip_outbox(50);
  select * into v_message
  from pgmq.read('clip_tasks', greatest(30, p_lease_seconds), 1)
  limit 1;
  if found then
    perform pgmq.delete('clip_tasks', v_message.msg_id);
  end if;

  select * into v_task
  from public.job_tasks candidate
  where (
    (
      (candidate.status in ('queued', 'retry_wait') and coalesce(candidate.next_attempt_at, now()) <= now())
      or (candidate.status in ('leased', 'running') and candidate.lease_expires_at < now())
    )
    and (p_include_task_types is null or candidate.task_type = any(p_include_task_types))
    and not (candidate.task_type = any(coalesce(p_exclude_task_types, '{}'::text[])))
    and (
      candidate.task_type <> 'merge_transcript'
      or (
        select count(*)
        from public.job_tasks sibling
        where sibling.clip_job_id = candidate.clip_job_id
          and sibling.task_type = 'transcribe_chunk'
          and sibling.status = 'succeeded'
      ) >= coalesce((candidate.input_json->>'expectedChunks')::integer, 1)
    )
  )
  order by candidate.priority desc, candidate.created_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.job_tasks
  set status = 'leased',
      lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => greatest(30, p_lease_seconds)),
      heartbeat_at = now(),
      attempt = attempt + 1,
      started_at = coalesce(started_at, now())
  where id = v_task.id
  returning * into v_task;

  return next v_task;
end;
$$;

revoke all on function public.claim_clip_task_for_capabilities(text, integer, text[], text[])
  from public, anon, authenticated;
grant execute on function public.claim_clip_task_for_capabilities(text, integer, text[], text[])
  to service_role;

commit;
