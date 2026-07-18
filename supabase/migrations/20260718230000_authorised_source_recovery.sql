begin;

alter table public.clip_jobs
  drop constraint if exists clip_jobs_status_check;
alter table public.clip_jobs
  add constraint clip_jobs_status_check check (status in (
    'draft','awaiting_source','awaiting_authorised_source','uploading','queued','validating',
    'creating_proxy','extracting_audio','transcribing','analysing','planning',
    'rendering_previews','ready','partially_ready','exporting','completed','failed',
    'cancelled','expiring','expired'
  ));

alter table public.job_tasks
  drop constraint if exists job_tasks_status_check;
alter table public.job_tasks
  add constraint job_tasks_status_check check (status in (
    'pending','queued','leased','running','retry_wait','succeeded','failed','cancelled',
    'dead_lettered','superseded'
  ));

alter table public.clip_jobs
  add column if not exists source_match_json jsonb not null default '{}'::jsonb;

alter table public.source_attachments
  add column if not exists idempotency_key uuid;
create unique index if not exists source_attachments_idempotency_idx
  on public.source_attachments(idempotency_key)
  where idempotency_key is not null;

create or replace function public.attach_source_and_resume_clip_job(
  p_job_id uuid,
  p_media_asset_id uuid,
  p_connector_id text,
  p_connector_import_id uuid default null,
  p_idempotency_key uuid default gen_random_uuid(),
  p_confirm_mismatch boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.clip_jobs%rowtype;
  v_asset public.media_assets%rowtype;
  v_attachment public.source_attachments%rowtype;
  v_task_id uuid := gen_random_uuid();
  v_expected numeric;
  v_actual numeric;
  v_delta numeric;
  v_tolerance numeric;
  v_confidence numeric(4,3);
  v_reason text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_job from public.clip_jobs where id = p_job_id for update;
  if not found or v_job.user_id <> v_user_id or not public.is_workspace_member(v_job.workspace_id) then
    raise exception 'job_access_denied' using errcode = '42501';
  end if;

  select * into v_attachment
  from public.source_attachments
  where idempotency_key = p_idempotency_key;
  if found then
    if v_attachment.clip_job_id <> p_job_id or v_attachment.media_asset_id <> p_media_asset_id then
      raise exception 'idempotency_key_reused' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'jobId', p_job_id,
      'status', (select status from public.clip_jobs where id = p_job_id),
      'assetId', p_media_asset_id,
      'idempotent', true
    );
  end if;

  if v_job.status <> 'awaiting_authorised_source' then
    raise exception 'source_recovery_not_available' using errcode = '22023';
  end if;
  if p_connector_id not in ('local_upload','google_drive','dropbox','onedrive') then
    raise exception 'invalid_source_connector' using errcode = '22023';
  end if;

  select * into v_asset from public.media_assets where id = p_media_asset_id;
  if not found or v_asset.workspace_id <> v_job.workspace_id or v_asset.user_id <> v_user_id then
    raise exception 'source_asset_access_denied' using errcode = '42501';
  end if;
  if v_asset.status not in ('uploaded','ready') or v_asset.storage_bucket is null or v_asset.storage_path is null then
    raise exception 'source_asset_not_ready' using errcode = '22023';
  end if;

  if p_connector_import_id is not null and not exists (
    select 1 from public.connector_imports i
    where i.id = p_connector_import_id
      and i.workspace_id = v_job.workspace_id
      and i.user_id = v_user_id
      and i.status = 'ready'
      and i.destination_asset_id = p_media_asset_id
  ) then
    raise exception 'connector_import_not_ready' using errcode = '22023';
  end if;

  v_expected := nullif(v_job.source_duration_seconds, 0);
  v_actual := nullif(v_asset.duration_seconds, 0);
  v_delta := case when v_expected is not null and v_actual is not null then abs(v_actual - v_expected) end;
  v_tolerance := case when v_expected is not null then greatest(5, v_expected * 0.05) end;
  v_confidence := case
    when v_delta is null then 0.500
    when v_delta <= greatest(2, v_expected * 0.01) then 0.990
    when v_delta <= v_tolerance then 0.850
    else 0.250
  end;
  v_reason := case
    when v_delta is null then 'Duration will be verified by FFprobe in the worker'
    when v_delta <= v_tolerance then format('Duration matches within %s seconds', round(v_delta, 2))
    else format('Duration differs by %s seconds', round(v_delta, 2))
  end;

  if v_actual is not null and v_expected is not null and v_actual > v_expected + v_tolerance then
    raise exception 'source_exceeds_reserved_duration' using
      errcode = '22023',
      detail = format('Expected at most %s seconds but received %s seconds', v_expected, v_actual);
  end if;

  if v_delta is not null and v_delta > v_tolerance and not p_confirm_mismatch then
    return jsonb_build_object(
      'jobId', p_job_id,
      'status', 'confirmation_required',
      'assetId', p_media_asset_id,
      'expectedDurationSeconds', v_expected,
      'actualDurationSeconds', v_actual,
      'matchConfidence', v_confidence,
      'matchReason', v_reason
    );
  end if;

  update public.job_tasks
  set status = 'superseded',
      completed_at = coalesce(completed_at, now()),
      lease_owner = null,
      lease_expires_at = null,
      next_attempt_at = null
  where clip_job_id = p_job_id
    and task_type in ('download_youtube_source','download_direct_source','validate_source')
    and status in ('pending','queued','retry_wait','failed','dead_lettered');

  insert into public.source_attachments (
    clip_job_id, connector_id, connector_import_id, media_asset_id, youtube_video_id,
    relationship, match_confidence, match_reason, idempotency_key
  ) values (
    p_job_id, left(p_connector_id, 80), p_connector_import_id, p_media_asset_id,
    v_job.youtube_video_id, 'primary', v_confidence,
    v_reason || case when p_confirm_mismatch then '; user confirmed the mismatch' else '' end,
    p_idempotency_key
  );

  update public.clip_jobs
  set source_asset_id = p_media_asset_id,
      status = 'queued',
      error_code = null,
      error_message = null,
      completed_at = null,
      source_match_json = jsonb_build_object(
        'status', case when p_confirm_mismatch then 'user_confirmed' else 'preflight_match' end,
        'expectedDurationSeconds', v_expected,
        'assetDurationSeconds', v_actual,
        'confidence', v_confidence,
        'reason', v_reason,
        'connectorId', p_connector_id,
        'connectorImportId', p_connector_import_id,
        'confirmedMismatch', p_confirm_mismatch,
        'attachedAt', now()
      ),
      updated_at = now()
  where id = p_job_id;

  insert into public.job_tasks (
    id, clip_job_id, task_type, status, priority, input_json, idempotency_key, next_attempt_at
  ) values (
    v_task_id, p_job_id, 'validate_source', 'queued', v_job.priority,
    jsonb_build_object(
      'authorisedSourceRecovery', true,
      'expectedDurationSeconds', v_expected,
      'confirmedMismatch', p_confirm_mismatch,
      'connectorId', p_connector_id
    ),
    p_job_id::text || ':validate-authorised:' || p_media_asset_id::text || ':' || p_idempotency_key::text,
    now()
  );

  insert into public.processing_events (
    clip_job_id, job_task_id, stage, severity, message
  ) values (
    p_job_id, v_task_id, 'authorised_source_attached', 'info',
    'Authorised source attached to the existing job. Validation is queued.'
  );
  insert into public.outbox_events (aggregate_type, aggregate_id, event_type, payload_json)
  values (
    'clip_job', p_job_id, 'task.queued',
    jsonb_build_object('jobId', p_job_id, 'taskId', v_task_id, 'taskType', 'validate_source')
  );

  return jsonb_build_object(
    'jobId', p_job_id,
    'status', 'queued',
    'assetId', p_media_asset_id,
    'taskId', v_task_id,
    'matchConfidence', v_confidence,
    'matchReason', v_reason,
    'idempotent', false
  );
end;
$$;

create or replace function public.attach_direct_source_and_resume_clip_job(
  p_job_id uuid,
  p_source_url text,
  p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.clip_jobs%rowtype;
  v_existing_task public.job_tasks%rowtype;
  v_task_id uuid := gen_random_uuid();
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into v_job from public.clip_jobs where id = p_job_id for update;
  if not found or v_job.user_id <> v_user_id or not public.is_workspace_member(v_job.workspace_id) then
    raise exception 'job_access_denied' using errcode = '42501';
  end if;
  if p_source_url !~ '^https://[^[:space:]]+$' or length(p_source_url) > 2048 then
    raise exception 'invalid_direct_source_url' using errcode = '22023';
  end if;

  select * into v_existing_task
    from public.job_tasks
    where clip_job_id = p_job_id
      and idempotency_key = p_job_id::text || ':download-authorised:' || p_idempotency_key::text;
  if found then
    if v_existing_task.input_json->>'url' <> p_source_url then
      raise exception 'idempotency_key_reused' using errcode = '23505';
    end if;
    return jsonb_build_object('jobId', p_job_id, 'status', v_job.status, 'idempotent', true);
  end if;

  if v_job.status <> 'awaiting_authorised_source' then
    raise exception 'source_recovery_not_available' using errcode = '22023';
  end if;

  update public.job_tasks
  set status = 'superseded', completed_at = coalesce(completed_at, now()),
      lease_owner = null, lease_expires_at = null, next_attempt_at = null
  where clip_job_id = p_job_id
    and task_type in ('download_youtube_source','download_direct_source','validate_source')
    and status in ('pending','queued','retry_wait','failed','dead_lettered');

  update public.clip_jobs
  set source_asset_id = null,
      status = 'queued', error_code = null, error_message = null, completed_at = null,
      source_match_json = jsonb_build_object(
        'status', 'awaiting_worker_download', 'connectorId', 'direct_url', 'attachedAt', now()
      ),
      updated_at = now()
  where id = p_job_id;

  insert into public.job_tasks (
    id, clip_job_id, task_type, status, priority, input_json, idempotency_key, next_attempt_at
  ) values (
    v_task_id, p_job_id, 'download_direct_source', 'queued', v_job.priority,
    jsonb_build_object('url', p_source_url, 'authorisedSourceRecovery', true),
    p_job_id::text || ':download-authorised:' || p_idempotency_key::text, now()
  );
  insert into public.processing_events (clip_job_id, job_task_id, stage, severity, message)
  values (
    p_job_id, v_task_id, 'authorised_source_attached', 'info',
    'Owner-controlled media link attached to the existing job. Secure import is queued.'
  );
  insert into public.outbox_events (aggregate_type, aggregate_id, event_type, payload_json)
  values (
    'clip_job', p_job_id, 'task.queued',
    jsonb_build_object('jobId', p_job_id, 'taskId', v_task_id, 'taskType', 'download_direct_source')
  );
  return jsonb_build_object('jobId', p_job_id, 'status', 'queued', 'taskId', v_task_id, 'idempotent', false);
end;
$$;

create or replace function public.fail_clip_task(
  p_task_id uuid, p_worker_id text, p_error_code text, p_error_message text,
  p_retryable boolean, p_next_attempt_at timestamptz default null
) returns text language plpgsql security definer set search_path = '' as $$
declare v_task public.job_tasks%rowtype; v_status text; v_publish_job_id uuid; v_recoverable_source boolean;
begin
  select * into v_task from public.job_tasks where id = p_task_id and lease_owner = p_worker_id for update;
  if not found then return 'lease_lost'; end if;
  v_status := case when p_retryable and v_task.attempt < v_task.max_attempts then 'retry_wait' when p_retryable then 'dead_lettered' else 'failed' end;
  update public.job_tasks set status = v_status, error_code = p_error_code, error_message = left(p_error_message,2000),
    next_attempt_at = case when v_status = 'retry_wait' then coalesce(p_next_attempt_at,now()+interval '1 minute') else null end,
    lease_owner = null, lease_expires_at = null, completed_at = case when v_status in ('failed','dead_lettered') then now() else null end
  where id = p_task_id;
  insert into public.processing_events (clip_job_id,job_task_id,stage,severity,message,attempt)
  values (v_task.clip_job_id,v_task.id,v_task.task_type,case when v_status='retry_wait' then 'warning' else 'error' end,left(p_error_message,2000),v_task.attempt);

  v_recoverable_source := v_status in ('failed','dead_lettered') and (
    (v_task.task_type = 'download_youtube_source' and p_error_code in (
      'provider_auth_challenge','provider_rate_limited','provider_temporary_failure',
      'download_timeout','ytdlp_error','video_restricted'
    )) or p_error_code = 'source_match_confirmation_required'
  );

  if v_task.task_type = 'publish_youtube_video' then
    begin v_publish_job_id := nullif(v_task.input_json->>'publishingJobId','')::uuid;
    exception when invalid_text_representation then v_publish_job_id := null; end;
    if v_publish_job_id is not null then
      update public.publishing_jobs set
        status = case when v_status='retry_wait' then status when p_error_code='youtube_reconnect_required' then 'reconnect_required' else 'failed' end,
        last_error_code=p_error_code,last_error_message=left(p_error_message,2000),updated_at=now()
      where id=v_publish_job_id;
    end if;
  elsif v_recoverable_source then
    update public.clip_jobs set
      status='awaiting_authorised_source', error_code=p_error_code,
      error_message=case when p_error_code='source_match_confirmation_required'
        then left(p_error_message,2000)
        else 'YouTube could not deliver this source to the protected worker. Attach an authorised original or owner-controlled media link to continue this same job.' end,
      updated_at=now()
    where id=v_task.clip_job_id;
    insert into public.processing_events (clip_job_id,job_task_id,stage,severity,message,attempt)
    values (
      v_task.clip_job_id,v_task.id,'awaiting_authorised_source','warning',
      case when p_error_code='source_match_confirmation_required'
        then 'The attached file needs confirmation before processing can continue.'
        else 'Automatic acquisition stopped. This job is waiting for an authorised source.' end,
      v_task.attempt
    );
  elsif v_status in ('failed','dead_lettered') then
    update public.clip_jobs set status='failed',error_code=p_error_code,error_message=left(p_error_message,2000),updated_at=now()
    where id=v_task.clip_job_id;
  end if;
  return v_status;
end;
$$;

update public.clip_jobs
set status = 'awaiting_authorised_source',
    error_message = 'YouTube could not deliver this source to the protected worker. Attach an authorised original or owner-controlled media link to continue this same job.',
    updated_at = now()
where status = 'failed'
  and error_code in ('provider_auth_challenge','provider_rate_limited','provider_temporary_failure','download_timeout','ytdlp_error','video_restricted')
  and exists (
    select 1 from public.job_tasks t
    where t.clip_job_id = clip_jobs.id and t.task_type = 'download_youtube_source'
  );

revoke all on function public.attach_source_and_resume_clip_job(uuid,uuid,text,uuid,uuid,boolean) from public, anon;
grant execute on function public.attach_source_and_resume_clip_job(uuid,uuid,text,uuid,uuid,boolean) to authenticated;
revoke all on function public.attach_direct_source_and_resume_clip_job(uuid,text,uuid) from public, anon;
grant execute on function public.attach_direct_source_and_resume_clip_job(uuid,text,uuid) to authenticated;
revoke all on function public.fail_clip_task(uuid,text,text,text,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.fail_clip_task(uuid,text,text,text,boolean,timestamptz) to service_role;

commit;
