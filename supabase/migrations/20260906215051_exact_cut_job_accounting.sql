begin;

alter table public.clip_jobs
  add column creation_idempotency_key text,
  add column creation_request_fingerprint text;
create unique index clip_job_creation_idempotency on public.clip_jobs
  (workspace_id,user_id,creation_idempotency_key) where creation_idempotency_key is not null;

-- This same creation boundary serves discovery and Exact Cut; no second queue or
-- usage ledger. Browser estimates never determine the authoritative debit.
create or replace function public.create_clip_job(
  p_workspace_id uuid, p_source_type text, p_source_url text,
  p_source_identifier text, p_source_duration_seconds bigint, p_source_asset_id uuid,
  p_source_metadata jsonb, p_settings jsonb, p_requested_clip_count integer,
  p_attestation_version text, p_policy_version text, p_request_metadata jsonb,
  p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_period public.usage_periods%rowtype;
  v_existing public.clip_jobs%rowtype;
  v_job_id uuid;
  v_mode text := coalesce(p_settings->>'mode','ai_discovery');
  v_range jsonb;
  v_start numeric; v_end numeric; v_milliseconds numeric := 0;
  v_billable_seconds bigint;
  v_fingerprint text;
begin
  if v_user_id is null or not public.is_workspace_member(p_workspace_id) then
    raise exception 'workspace_access_denied' using errcode='42501';
  end if;
  if p_attestation_version is distinct from 'youtube-clipper-rights-v1'
    or p_policy_version is distinct from 'vidrial-content-policy-v1'
    or p_source_duration_seconds is null or p_source_duration_seconds<=0
    or p_requested_clip_count is null or p_requested_clip_count<1
    or p_idempotency_key is null or length(p_idempotency_key) not between 1 and 200
    or p_source_type is null or p_source_type not in (
      'local_upload','direct_owned_media_url','youtube_metadata','youtube_connected_channel',
      'google_drive','dropbox','onedrive','rss','s3')
    or jsonb_typeof(p_settings) is distinct from 'object'
    or jsonb_typeof(p_source_metadata) is distinct from 'object'
    or length(p_settings::text)>32768
    or v_mode not in ('ai_discovery','manual_timestamp') then
    raise exception 'invalid_job_request' using errcode='22023';
  end if;
  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'sourceType',p_source_type,'url',p_source_url,'identifier',p_source_identifier,
    'duration',p_source_duration_seconds,'asset',p_source_asset_id,'metadata',p_source_metadata,
    'settings',p_settings,'count',p_requested_clip_count,
    'rights',p_attestation_version,'policy',p_policy_version
  )::text,'UTF8')),'hex');

  -- All modes use this workspace lock, preventing count/reservation races.
  perform 1 from public.workspaces where id=p_workspace_id for update;
  if not found then raise exception 'workspace_access_denied' using errcode='42501'; end if;
  select * into v_existing from public.clip_jobs
    where workspace_id=p_workspace_id and user_id=v_user_id and creation_idempotency_key=p_idempotency_key;
  if found then
    if v_existing.creation_request_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_key_conflict' using errcode='22023';
    end if;
    return v_existing.id;
  end if;

  select p.* into v_plan from public.profiles pr join public.plans p on p.key=pr.plan_key
    where pr.id=v_user_id and p.active;
  if not found or p_source_duration_seconds>v_plan.max_source_seconds_per_job
    or p_requested_clip_count>v_plan.max_clips_per_job then
    raise exception 'plan_limit_exceeded' using errcode='22023';
  end if;
  if p_source_asset_id is not null then
    perform 1 from public.media_assets where id=p_source_asset_id and user_id=v_user_id
      and workspace_id=p_workspace_id and deleted_at is null and status in ('uploaded','ready')
      and storage_bucket='source-media'
      and starts_with(storage_path,p_workspace_id::text||'/'||v_user_id::text||'/');
    if not found then raise exception 'source_access_denied' using errcode='42501'; end if;
  elsif p_source_type not in ('direct_owned_media_url','youtube_metadata','youtube_connected_channel')
    or p_source_url is null or length(p_source_url)>2048 then
    raise exception 'source_required' using errcode='22023';
  end if;

  if v_mode='manual_timestamp' then
    if jsonb_typeof(p_settings->'ranges') is distinct from 'array' then
      raise exception 'invalid_clip_ranges' using errcode='22023';
    end if;
    if jsonb_array_length(p_settings->'ranges')<>p_requested_clip_count then
      raise exception 'invalid_clip_ranges' using errcode='22023';
    end if;
    for v_range in select value from jsonb_array_elements(p_settings->'ranges') loop
      if jsonb_typeof(v_range) is distinct from 'object'
        or jsonb_typeof(v_range->'startSeconds') is distinct from 'number'
        or jsonb_typeof(v_range->'endSeconds') is distinct from 'number'
        or (v_range ? 'label' and (jsonb_typeof(v_range->'label') is distinct from 'string' or length(v_range->>'label')>120)) then
        raise exception 'invalid_clip_ranges' using errcode='22023';
      end if;
      v_start := (v_range->>'startSeconds')::numeric;
      v_end := (v_range->>'endSeconds')::numeric;
      if v_start<0 or v_end<=v_start or v_end>p_source_duration_seconds
        or v_start*1000<>trunc(v_start*1000) or v_end*1000<>trunc(v_end*1000) then
        raise exception 'invalid_clip_ranges' using errcode='22023';
      end if;
      v_milliseconds := v_milliseconds+(v_end-v_start)*1000;
    end loop;
    v_billable_seconds := ceil(v_milliseconds/1000)::bigint;
    -- Captions are an explicit subsequent operation, never an implicit planner path.
    if coalesce(p_settings->>'captionsRequested','false')<>'false' then
      raise exception 'captions_require_explicit_request' using errcode='22023';
    end if;
  else
    v_billable_seconds := p_source_duration_seconds;
  end if;
  if (select count(*) from public.clip_jobs where workspace_id=p_workspace_id
    and status not in ('ready','partially_ready','completed','failed','cancelled','expiring','expired'))>=v_plan.max_concurrent_jobs then
    raise exception 'concurrent_job_limit_exceeded' using errcode='22023';
  end if;
  insert into public.usage_periods(workspace_id,plan_key,period_start,period_end,source_seconds_limit)
    values(p_workspace_id,v_plan.key,date_trunc('month',now()),date_trunc('month',now())+interval '1 month',v_plan.monthly_source_seconds)
    on conflict(workspace_id,period_start) do update set updated_at=now() returning * into v_period;
  select * into v_period from public.usage_periods where id=v_period.id for update;
  if v_period.source_seconds_reserved+v_period.source_seconds_committed+v_billable_seconds>v_period.source_seconds_limit then
    raise exception 'insufficient_usage' using errcode='22023';
  end if;
  update public.usage_periods set source_seconds_reserved=source_seconds_reserved+v_billable_seconds,updated_at=now() where id=v_period.id;
  insert into public.clip_jobs(
    workspace_id,user_id,source_asset_id,source_type,source_url,youtube_video_id,source_title,
    source_channel_id,source_channel_title,source_thumbnail_url,source_duration_seconds,settings_json,
    requested_clip_count,status,priority,reserved_source_seconds,watermark_required,export_limit_json,
    retention_expires_at,creation_idempotency_key,creation_request_fingerprint
  ) values(
    p_workspace_id,v_user_id,p_source_asset_id,p_source_type,p_source_url,p_source_identifier,
    p_source_metadata->>'title',p_source_metadata->>'channelId',p_source_metadata->>'channelTitle',
    p_source_metadata->>'thumbnailUrl',p_source_duration_seconds,p_settings,p_requested_clip_count,
    case when p_source_asset_id is null then 'awaiting_source' else 'queued' end,v_plan.priority,
    v_billable_seconds,v_plan.watermark_required,
    jsonb_build_object('width',v_plan.max_export_width,'height',v_plan.max_export_height,'fps',v_plan.max_export_fps),
    now()+make_interval(days=>v_plan.retention_days),p_idempotency_key,v_fingerprint
  ) returning id into v_job_id;
  insert into public.rights_attestations(workspace_id,user_id,clip_job_id,source_url,source_identifier,attestation_version,policy_version,accepted_at,request_metadata_json)
    values(p_workspace_id,v_user_id,v_job_id,p_source_url,p_source_identifier,p_attestation_version,p_policy_version,now(),coalesce(p_request_metadata,'{}'::jsonb));
  insert into public.usage_ledger(workspace_id,user_id,job_id,category,amount,unit,direction,state,idempotency_key,description)
    values(p_workspace_id,v_user_id,v_job_id,'source_analysis',v_billable_seconds,'seconds','debit','reserved',v_job_id::text||':usage:reserve',
      case when v_mode='manual_timestamp' then 'Selected range seconds reserved' else 'Source seconds reserved' end);
  if p_source_asset_id is not null then
    insert into public.job_tasks(clip_job_id,task_type,status,priority,idempotency_key,next_attempt_at)
      values(v_job_id,'validate_source','queued',v_plan.priority,v_job_id::text||':validate',now());
    insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload_json)
      values('clip_job',v_job_id,'task.queued',jsonb_build_object('jobId',v_job_id,'taskType','validate_source'));
  end if;
  return v_job_id;
end;
$$;

revoke all on function public.create_clip_job(uuid,text,text,text,bigint,uuid,jsonb,jsonb,integer,text,text,jsonb,text) from public,anon;
grant execute on function public.create_clip_job(uuid,text,text,text,bigint,uuid,jsonb,jsonb,integer,text,text,jsonb,text) to authenticated;

-- New jobs' accounting/source contract cannot be rewritten through generic table
-- UPDATE. Authorized RPCs and workers run with their privileged database role.
create function public.protect_clip_creation_contract() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if current_user in ('anon','authenticated') and old.creation_idempotency_key is not null and (
    new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id
    or new.settings_json is distinct from old.settings_json
    or new.source_asset_id is distinct from old.source_asset_id
    or new.source_type is distinct from old.source_type or new.source_url is distinct from old.source_url
    or new.youtube_video_id is distinct from old.youtube_video_id
    or new.source_duration_seconds is distinct from old.source_duration_seconds
    or new.requested_clip_count is distinct from old.requested_clip_count
    or new.reserved_source_seconds is distinct from old.reserved_source_seconds
    or new.committed_source_seconds is distinct from old.committed_source_seconds
    or new.watermark_required is distinct from old.watermark_required
    or new.export_limit_json is distinct from old.export_limit_json
    or new.retention_expires_at is distinct from old.retention_expires_at
    or (new.status is distinct from old.status and not(new.status='cancelled' and old.status not in ('completed','expiring','expired')))
    or new.creation_idempotency_key is distinct from old.creation_idempotency_key
    or new.creation_request_fingerprint is distinct from old.creation_request_fingerprint
  ) then raise exception 'immutable_job_contract' using errcode='42501'; end if;
  return new;
end $$;
create trigger clip_job_protect_creation_contract before update on public.clip_jobs
  for each row execute function public.protect_clip_creation_contract();
revoke all on function public.protect_clip_creation_contract() from public,anon,authenticated;

create or replace function public.release_early_failed_usage()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_period_id uuid;
begin
  if new.status in ('failed','cancelled') and old.status not in ('failed','cancelled')
    and new.committed_source_seconds=0 and new.reserved_source_seconds>0 then
    select id into v_period_id from public.usage_periods where workspace_id=new.workspace_id
      and period_start<=new.created_at and period_end>new.created_at for update;
    if v_period_id is null then raise exception 'usage_period_missing'; end if;
    update public.usage_periods set source_seconds_reserved=source_seconds_reserved-new.reserved_source_seconds,updated_at=now()
      where id=v_period_id;
    insert into public.usage_ledger(workspace_id,user_id,job_id,category,amount,unit,direction,state,idempotency_key,description)
      values(new.workspace_id,new.user_id,new.id,'source_analysis',new.reserved_source_seconds,'seconds','credit','released',
        new.id::text||':usage:release','Unused processing reservation released') on conflict(idempotency_key) do nothing;
    new.reserved_source_seconds:=0;
  end if;
  return new;
end $$;

create or replace function public.commit_source_usage(p_job_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_job public.clip_jobs%rowtype; v_period public.usage_periods%rowtype;
begin
  select * into v_job from public.clip_jobs where id=p_job_id for update;
  if not found or v_job.committed_source_seconds>0 or v_job.reserved_source_seconds<=0
    or v_job.status in ('failed','cancelled','expiring','expired') then return false; end if;
  select * into v_period from public.usage_periods where workspace_id=v_job.workspace_id
    and period_start<=v_job.created_at and period_end>v_job.created_at for update;
  if not found then raise exception 'usage_period_missing'; end if;
  update public.usage_periods set source_seconds_reserved=source_seconds_reserved-v_job.reserved_source_seconds,
    source_seconds_committed=source_seconds_committed+v_job.reserved_source_seconds,updated_at=now() where id=v_period.id;
  update public.clip_jobs set committed_source_seconds=reserved_source_seconds,reserved_source_seconds=0,updated_at=now() where id=p_job_id;
  insert into public.usage_ledger(workspace_id,user_id,job_id,category,amount,unit,direction,state,idempotency_key,description)
    values(v_job.workspace_id,v_job.user_id,v_job.id,'source_analysis',v_job.reserved_source_seconds,'seconds','debit','committed',
      v_job.id::text||':usage:commit','Processing seconds committed') on conflict(idempotency_key) do nothing;
  return true;
end $$;
revoke all on function public.commit_source_usage(uuid) from public,anon,authenticated;
grant execute on function public.commit_source_usage(uuid) to service_role;

commit;
