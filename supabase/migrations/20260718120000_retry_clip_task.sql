begin;

create or replace function public.retry_clip_task(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.clip_jobs%rowtype;
  v_task public.job_tasks%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_job
  from public.clip_jobs
  where id = p_job_id
  for update;

  if not found or not public.is_workspace_member(v_job.workspace_id) then
    raise exception 'job_access_denied' using errcode = '42501';
  end if;

  if v_job.status in ('cancelled', 'expiring', 'expired', 'completed', 'ready') then
    raise exception 'retry_not_available' using errcode = '22023';
  end if;

  select * into v_task
  from public.job_tasks
  where clip_job_id = p_job_id
    and status in ('failed', 'dead_lettered')
  order by completed_at desc nulls last, created_at desc
  limit 1
  for update;

  if not found
    or v_task.attempt >= v_task.max_attempts
    or coalesce(v_task.error_code, '') not in (
      'provider_auth_challenge',
      'provider_rate_limited',
      'provider_temporary_failure',
      'download_timeout',
      'ytdlp_error',
      'video_restricted',
      'plan_unavailable',
      'temporary_failure'
    ) then
    raise exception 'retry_not_available' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.job_tasks active
    where active.clip_job_id = p_job_id
      and active.id <> v_task.id
      and active.status in ('pending', 'queued', 'leased', 'running', 'retry_wait')
  ) then
    raise exception 'retry_already_active' using errcode = '55000';
  end if;

  update public.job_tasks
  set status = 'queued',
      next_attempt_at = now(),
      lease_owner = null,
      lease_expires_at = null,
      heartbeat_at = null,
      error_code = null,
      error_message = null,
      completed_at = null,
      progress_current = null,
      progress_total = null
  where id = v_task.id;

  update public.clip_jobs
  set status = 'queued',
      error_code = null,
      error_message = null,
      completed_at = null,
      updated_at = now()
  where id = p_job_id;

  insert into public.processing_events (
    clip_job_id, job_task_id, stage, severity, message, attempt
  ) values (
    p_job_id,
    v_task.id,
    v_task.task_type,
    'info',
    'Retry requested. The task is queued for another attempt.',
    v_task.attempt + 1
  );

  insert into public.outbox_events (
    aggregate_type, aggregate_id, event_type, payload_json
  ) values (
    'clip_job',
    p_job_id,
    'task.queued',
    jsonb_build_object(
      'jobId', p_job_id,
      'taskId', v_task.id,
      'taskType', v_task.task_type,
      'manualRetry', true
    )
  );

  return jsonb_build_object(
    'taskId', v_task.id,
    'jobId', p_job_id,
    'status', 'queued',
    'attempt', v_task.attempt,
    'maxAttempts', v_task.max_attempts
  );
end;
$$;

revoke all on function public.retry_clip_task(uuid) from public, anon;
grant execute on function public.retry_clip_task(uuid) to authenticated;

commit;
