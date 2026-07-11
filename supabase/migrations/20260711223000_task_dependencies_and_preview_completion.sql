begin;

create or replace function public.claim_clip_task(p_worker_id text, p_lease_seconds integer default 120)
returns setof public.job_tasks language plpgsql security definer set search_path = '' as $$
declare v_task public.job_tasks%rowtype; v_message record;
begin
  perform public.dispatch_clip_outbox(50);
  select * into v_message from pgmq.read('clip_tasks', greatest(30,p_lease_seconds), 1) limit 1;
  if found then perform pgmq.delete('clip_tasks', v_message.msg_id); end if;
  select * into v_task from public.job_tasks candidate
  where (
    ((candidate.status in ('queued','retry_wait') and coalesce(candidate.next_attempt_at,now()) <= now())
      or (candidate.status in ('leased','running') and candidate.lease_expires_at < now()))
    and (
      candidate.task_type <> 'merge_transcript'
      or (select count(*) from public.job_tasks sibling where sibling.clip_job_id = candidate.clip_job_id and sibling.task_type = 'transcribe_chunk' and sibling.status = 'succeeded')
         >= coalesce((candidate.input_json->>'expectedChunks')::integer,1)
    )
  )
  order by candidate.priority desc, candidate.created_at for update skip locked limit 1;
  if not found then return; end if;
  update public.job_tasks set status = 'leased', lease_owner = p_worker_id,
    lease_expires_at = now() + make_interval(secs => greatest(30,p_lease_seconds)), heartbeat_at = now(),
    attempt = attempt + 1, started_at = coalesce(started_at,now())
  where id = v_task.id returning * into v_task;
  return next v_task;
end;
$$;

create or replace function public.finalize_preview_job()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_remaining integer; v_failed integer; v_ready integer;
begin
  if new.task_type <> 'render_clip_preview' or new.status not in ('succeeded','failed','dead_lettered','cancelled') then return new; end if;
  select count(*) into v_remaining from public.job_tasks where clip_job_id = new.clip_job_id and task_type = 'render_clip_preview' and status not in ('succeeded','failed','dead_lettered','cancelled');
  if v_remaining = 0 then
    select count(*) into v_failed from public.job_tasks where clip_job_id = new.clip_job_id and task_type = 'render_clip_preview' and status in ('failed','dead_lettered');
    select count(*) into v_ready from public.clips where clip_job_id = new.clip_job_id and status = 'ready' and deleted_at is null;
    update public.clip_jobs set completed_clip_count = v_ready,
      status = case when v_ready > 0 and v_failed > 0 then 'partially_ready' when v_ready > 0 then 'ready' else 'failed' end,
      completed_at = case when v_ready > 0 then now() else completed_at end, updated_at = now()
    where id = new.clip_job_id;
  end if;
  return new;
end;
$$;

create trigger job_task_preview_finished after update of status on public.job_tasks
for each row execute procedure public.finalize_preview_job();

revoke all on function public.claim_clip_task(text,integer) from public, anon, authenticated;
grant execute on function public.claim_clip_task(text,integer) to service_role;

commit;
