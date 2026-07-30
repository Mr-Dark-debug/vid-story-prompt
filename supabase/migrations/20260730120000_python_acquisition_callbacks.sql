alter table public.acquisition_callback_receipts
  drop constraint if exists acquisition_callback_receipts_provider_check;
alter table public.acquisition_callback_receipts
  add constraint acquisition_callback_receipts_provider_check check (
    provider in ('local_relay','cobalt','python_acquisition')
  );

create or replace function public.record_python_acquisition_callback(
  p_provider_event_id text,
  p_job_task_id uuid,
  p_clip_job_id uuid,
  p_stage text,
  p_severity text,
  p_message text,
  p_progress_current bigint default null,
  p_progress_total bigint default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted uuid;
begin
  if length(p_provider_event_id) not between 8 and 300
    or p_stage not in (
      'python_acquisition_accepted',
      'python_acquisition_extracting',
      'python_acquisition_downloading',
      'python_acquisition_postprocessing',
      'python_acquisition_completed',
      'python_acquisition_failed',
      'python_acquisition_cancelled'
    )
    or p_severity not in ('info','warning','error')
    or length(p_message) not between 1 and 500
    or (p_progress_current is not null and p_progress_current < 0)
    or (p_progress_total is not null and p_progress_total <= 0)
    or (p_progress_current is not null and p_progress_total is not null and p_progress_current > p_progress_total)
  then
    raise exception 'invalid_python_acquisition_callback' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.job_tasks t
    where t.id = p_job_task_id and t.clip_job_id = p_clip_job_id
      and t.task_type = 'download_youtube_source'
  ) then
    raise exception 'python_acquisition_task_mismatch' using errcode = '42501';
  end if;

  insert into public.acquisition_callback_receipts (provider, provider_event_id)
  values ('python_acquisition', p_provider_event_id)
  on conflict (provider, provider_event_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return false;
  end if;

  insert into public.processing_events (
    clip_job_id, job_task_id, stage, severity, message,
    progress_current, progress_total, provider
  ) values (
    p_clip_job_id, p_job_task_id, p_stage, p_severity, p_message,
    p_progress_current, p_progress_total, 'python-yt-dlp'
  );
  return true;
end;
$$;

revoke all on function public.record_python_acquisition_callback(
  text,uuid,uuid,text,text,text,bigint,bigint
) from public, anon, authenticated;
grant execute on function public.record_python_acquisition_callback(
  text,uuid,uuid,text,text,text,bigint,bigint
) to service_role;
