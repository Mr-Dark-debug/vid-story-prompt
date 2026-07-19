begin;

alter table public.clip_jobs
  drop constraint if exists clip_jobs_status_check;
alter table public.clip_jobs
  add constraint clip_jobs_status_check check (status in (
    'draft','awaiting_source','awaiting_authorised_source','awaiting_local_relay',
    'uploading','queued','validating','creating_proxy','extracting_audio','transcribing',
    'analysing','planning','rendering_previews','ready','partially_ready','exporting',
    'completed','failed','cancelled','expiring','expired'
  ));

create table public.source_acquisition_attempts (
  id uuid primary key default gen_random_uuid(),
  clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
  job_task_id uuid not null references public.job_tasks(id) on delete cascade,
  ordinal integer not null check (ordinal > 0 and ordinal <= 100),
  source_tier text not null check (source_tier in (
    'direct','operator_proxy','warp','cobalt','local_relay','authorised_source'
  )),
  strategy text,
  pool_member_index integer check (pool_member_index is null or pool_member_index >= 0),
  pool_member_id text check (pool_member_id is null or length(pool_member_id) <= 120),
  egress_fingerprint text check (
    egress_fingerprint is null or length(egress_fingerprint) between 16 and 128
  ),
  status text not null default 'queued' check (status in (
    'queued','leased','running','awaiting_callback','succeeded','failed','cancelled','superseded'
  )),
  error_code text check (error_code is null or length(error_code) <= 120),
  error_message text check (error_message is null or length(error_message) <= 2000),
  idempotency_key text not null unique check (length(idempotency_key) between 8 and 500),
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_task_id, ordinal)
);

create index source_acquisition_attempts_job_created_idx
  on public.source_acquisition_attempts(clip_job_id, created_at);
create index source_acquisition_attempts_task_status_idx
  on public.source_acquisition_attempts(job_task_id, status, ordinal);

create table public.acquisition_relay_devices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 120),
  credential_hash text not null unique check (length(credential_hash) between 32 and 128),
  helper_version text not null check (length(helper_version) between 1 and 40),
  status text not null default 'active' check (status in ('active','revoked')),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'revoked') = (revoked_at is not null))
);

create index acquisition_relay_devices_owner_idx
  on public.acquisition_relay_devices(workspace_id, user_id, status);

create table public.acquisition_relay_pairings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_hash text not null unique check (length(challenge_hash) between 32 and 128),
  display_code_hash text not null unique check (length(display_code_hash) between 32 and 128),
  status text not null default 'pending' check (status in ('pending','completed','expired','cancelled')),
  expires_at timestamptz not null,
  completed_device_id uuid references public.acquisition_relay_devices(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((status = 'completed') = (completed_device_id is not null and completed_at is not null))
);

create index acquisition_relay_pairings_owner_status_idx
  on public.acquisition_relay_pairings(workspace_id, user_id, status, expires_at);

create table public.acquisition_relay_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
  job_task_id uuid references public.job_tasks(id) on delete set null,
  acquisition_attempt_id uuid references public.source_acquisition_attempts(id) on delete set null,
  requested_device_id uuid references public.acquisition_relay_devices(id) on delete set null,
  leased_device_id uuid references public.acquisition_relay_devices(id) on delete set null,
  capability_hash text not null unique check (length(capability_hash) between 32 and 128),
  nonce_hash text not null unique check (length(nonce_hash) between 32 and 128),
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  expected_duration_seconds numeric not null check (expected_duration_seconds > 0),
  source_section jsonb,
  upload_bucket text not null default 'source-media' check (upload_bucket = 'source-media'),
  upload_path text not null unique check (length(upload_path) between 20 and 1024),
  maximum_bytes bigint not null check (maximum_bytes > 0),
  status text not null default 'pending' check (status in (
    'pending','leased','downloading','uploading','completed','failed','cancelled','expired'
  )),
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  progress_current bigint check (progress_current is null or progress_current >= 0),
  progress_total bigint check (progress_total is null or progress_total >= 0),
  error_code text check (error_code is null or length(error_code) <= 120),
  error_message text check (error_message is null or length(error_message) <= 2000),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  media_asset_id uuid references public.media_assets(id) on delete set null,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (
    source_section is null or (
      jsonb_typeof(source_section) = 'object'
      and jsonb_typeof(source_section->'startSeconds') = 'number'
      and jsonb_typeof(source_section->'endSeconds') = 'number'
      and (source_section->>'startSeconds')::numeric >= 0
      and (source_section->>'endSeconds')::numeric > (source_section->>'startSeconds')::numeric
      and (source_section->>'endSeconds')::numeric <= expected_duration_seconds
    )
  ),
  check (
    (status = 'completed' and media_asset_id is not null and completed_at is not null)
    or (status <> 'completed' and media_asset_id is null and completed_at is null)
  )
);

create unique index acquisition_relay_requests_active_job_idx
  on public.acquisition_relay_requests(clip_job_id)
  where status in ('pending','leased','downloading','uploading');
create index acquisition_relay_requests_device_status_idx
  on public.acquisition_relay_requests(requested_device_id, status, created_at);
create index acquisition_relay_requests_owner_status_idx
  on public.acquisition_relay_requests(workspace_id, user_id, status, created_at);

create table public.acquisition_callback_receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('local_relay','cobalt')),
  provider_event_id text not null check (length(provider_event_id) between 8 and 300),
  relay_request_id uuid references public.acquisition_relay_requests(id) on delete cascade,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table public.processing_events
  add column if not exists source_tier text,
  add column if not exists pool_member_index integer,
  add column if not exists acquisition_attempt_id uuid
    references public.source_acquisition_attempts(id) on delete set null;

alter table public.processing_events
  drop constraint if exists processing_events_source_tier_check;
alter table public.processing_events
  add constraint processing_events_source_tier_check check (
    source_tier is null or source_tier in (
      'direct','operator_proxy','warp','cobalt','local_relay','authorised_source'
    )
  );
alter table public.processing_events
  drop constraint if exists processing_events_pool_member_index_check;
alter table public.processing_events
  add constraint processing_events_pool_member_index_check check (
    pool_member_index is null or pool_member_index >= 0
  );

alter table public.source_acquisition_attempts enable row level security;
alter table public.acquisition_relay_devices enable row level security;
alter table public.acquisition_relay_pairings enable row level security;
alter table public.acquisition_relay_requests enable row level security;
alter table public.acquisition_callback_receipts enable row level security;

create policy source_acquisition_attempts_select
  on public.source_acquisition_attempts for select to authenticated
  using (exists (
    select 1 from public.clip_jobs j
    where j.id = clip_job_id and public.is_workspace_member(j.workspace_id)
  ));

create policy acquisition_relay_devices_select
  on public.acquisition_relay_devices for select to authenticated
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy acquisition_relay_pairings_select
  on public.acquisition_relay_pairings for select to authenticated
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy acquisition_relay_requests_select
  on public.acquisition_relay_requests for select to authenticated
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create or replace function public.record_source_acquisition_attempt(
  p_job_task_id uuid,
  p_ordinal integer,
  p_source_tier text,
  p_strategy text,
  p_pool_member_index integer,
  p_pool_member_id text,
  p_egress_fingerprint text,
  p_idempotency_key text
) returns public.source_acquisition_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.job_tasks%rowtype;
  v_attempt public.source_acquisition_attempts%rowtype;
begin
  select * into v_task from public.job_tasks where id = p_job_task_id;
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  if p_source_tier not in ('direct','operator_proxy','warp','cobalt','local_relay','authorised_source') then
    raise exception 'invalid_source_tier' using errcode = '22023';
  end if;

  select * into v_attempt
  from public.source_acquisition_attempts
  where idempotency_key = p_idempotency_key;
  if found then
    if v_attempt.job_task_id <> p_job_task_id
      or v_attempt.ordinal <> p_ordinal
      or v_attempt.source_tier <> p_source_tier then
      raise exception 'idempotency_key_reused' using errcode = '23505';
    end if;
    return v_attempt;
  end if;

  insert into public.source_acquisition_attempts (
    clip_job_id, job_task_id, ordinal, source_tier, strategy,
    pool_member_index, pool_member_id, egress_fingerprint,
    status, idempotency_key, started_at, heartbeat_at
  ) values (
    v_task.clip_job_id, v_task.id, p_ordinal, p_source_tier, nullif(p_strategy,''),
    p_pool_member_index, nullif(left(p_pool_member_id,120),''),
    nullif(left(p_egress_fingerprint,128),''), 'running', p_idempotency_key, now(), now()
  ) returning * into v_attempt;

  insert into public.processing_events (
    clip_job_id, job_task_id, stage, severity, message, attempt,
    proxy_tier, source_tier, pool_member_index, acquisition_attempt_id
  ) values (
    v_task.clip_job_id, v_task.id, 'source_acquisition_attempt', 'info',
    case p_source_tier
      when 'warp' then 'Trying a distinct protected YouTube egress path.'
      when 'operator_proxy' then 'Trying the operator-configured YouTube egress path.'
      when 'cobalt' then 'Trying the optional self-hosted source adapter.'
      when 'local_relay' then 'Waiting for the paired device to acquire the authorised source.'
      else 'Trying the next authorised source acquisition path.'
    end,
    v_task.attempt,
    case p_source_tier when 'operator_proxy' then 'operator' when 'warp' then 'warp' else null end,
    p_source_tier, p_pool_member_index, v_attempt.id
  );
  return v_attempt;
end;
$$;

create or replace function public.finish_source_acquisition_attempt(
  p_attempt_id uuid,
  p_status text,
  p_error_code text default null,
  p_error_message text default null
) returns public.source_acquisition_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempt public.source_acquisition_attempts%rowtype;
begin
  if p_status not in ('succeeded','failed','cancelled','superseded','awaiting_callback') then
    raise exception 'invalid_attempt_status' using errcode = '22023';
  end if;
  select * into v_attempt from public.source_acquisition_attempts where id = p_attempt_id for update;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if v_attempt.status in ('succeeded','failed','cancelled','superseded') then return v_attempt; end if;
  update public.source_acquisition_attempts set
    status = p_status,
    error_code = nullif(left(p_error_code,120),''),
    error_message = nullif(left(p_error_message,2000),''),
    heartbeat_at = now(),
    completed_at = case when p_status = 'awaiting_callback' then null else now() end
  where id = p_attempt_id returning * into v_attempt;
  return v_attempt;
end;
$$;

create or replace function public.create_acquisition_relay_request(
  p_job_task_id uuid,
  p_acquisition_attempt_id uuid,
  p_capability_hash text,
  p_nonce_hash text,
  p_upload_path text,
  p_maximum_bytes bigint,
  p_source_section jsonb default null,
  p_requested_device_id uuid default null,
  p_expires_at timestamptz default now() + interval '2 hours'
) returns public.acquisition_relay_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.job_tasks%rowtype;
  v_job public.clip_jobs%rowtype;
  v_request public.acquisition_relay_requests%rowtype;
begin
  select * into v_task from public.job_tasks where id = p_job_task_id for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  select * into v_job from public.clip_jobs where id = v_task.clip_job_id for update;
  if v_job.youtube_video_id is null then raise exception 'youtube_video_missing' using errcode = '22023'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '24 hours' then
    raise exception 'invalid_relay_expiry' using errcode = '22023';
  end if;
  if p_upload_path !~ ('^' || v_job.workspace_id::text || '/' || v_job.user_id::text || '/' || v_job.id::text || '/relay/[0-9a-f-]{36}\.[a-z0-9]{1,8}$') then
    raise exception 'invalid_relay_upload_path' using errcode = '22023';
  end if;
  if p_requested_device_id is not null and not exists (
    select 1 from public.acquisition_relay_devices d
    where d.id = p_requested_device_id and d.workspace_id = v_job.workspace_id
      and d.user_id = v_job.user_id and d.status = 'active'
  ) then raise exception 'relay_device_unavailable' using errcode = '22023'; end if;

  select * into v_request from public.acquisition_relay_requests
  where clip_job_id = v_job.id and status in ('pending','leased','downloading','uploading');
  if found then return v_request; end if;

  insert into public.acquisition_relay_requests (
    workspace_id, user_id, clip_job_id, job_task_id, acquisition_attempt_id,
    requested_device_id, capability_hash, nonce_hash, youtube_video_id,
    expected_duration_seconds, source_section, upload_path, maximum_bytes, expires_at
  ) values (
    v_job.workspace_id, v_job.user_id, v_job.id, v_task.id, p_acquisition_attempt_id,
    p_requested_device_id, p_capability_hash, p_nonce_hash, v_job.youtube_video_id,
    v_job.source_duration_seconds, p_source_section, p_upload_path, p_maximum_bytes, p_expires_at
  ) returning * into v_request;

  update public.clip_jobs set status = 'awaiting_local_relay', updated_at = now()
  where id = v_job.id and status not in ('cancelled','expiring','expired');
  update public.source_acquisition_attempts set status = 'awaiting_callback', heartbeat_at = now()
  where id = p_acquisition_attempt_id and status in ('queued','leased','running');
  insert into public.processing_events (
    clip_job_id, job_task_id, stage, severity, message, source_tier, acquisition_attempt_id
  ) values (
    v_job.id, v_task.id, 'awaiting_local_relay', 'warning',
    'Cloud acquisition was blocked. A paired device can continue this job through its local connection.',
    'local_relay', p_acquisition_attempt_id
  );
  return v_request;
end;
$$;

create or replace function public.lease_acquisition_relay_request(
  p_request_id uuid,
  p_device_id uuid,
  p_lease_seconds integer default 120
) returns public.acquisition_relay_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.acquisition_relay_requests%rowtype;
  v_device public.acquisition_relay_devices%rowtype;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception 'invalid_lease_seconds' using errcode = '22023';
  end if;
  select * into v_device from public.acquisition_relay_devices where id = p_device_id for update;
  if not found or v_device.status <> 'active' then raise exception 'relay_device_unavailable' using errcode = '42501'; end if;
  select * into v_request from public.acquisition_relay_requests where id = p_request_id for update;
  if not found then raise exception 'relay_request_not_found' using errcode = 'P0002'; end if;
  if v_request.workspace_id <> v_device.workspace_id or v_request.user_id <> v_device.user_id then
    raise exception 'relay_request_access_denied' using errcode = '42501';
  end if;
  if v_request.requested_device_id is not null and v_request.requested_device_id <> p_device_id then
    raise exception 'relay_request_device_mismatch' using errcode = '42501';
  end if;
  if v_request.expires_at <= now() then
    update public.acquisition_relay_requests set status = 'expired', updated_at = now()
    where id = p_request_id;
    raise exception 'relay_request_expired' using errcode = '22023';
  end if;
  if v_request.status = 'completed' then return v_request; end if;
  if v_request.status not in ('pending','leased','downloading','uploading') then
    raise exception 'relay_request_not_leaseable' using errcode = '22023';
  end if;
  if v_request.leased_device_id is not null and v_request.leased_device_id <> p_device_id
    and v_request.lease_expires_at > now() then
    raise exception 'relay_request_already_leased' using errcode = '55P03';
  end if;
  update public.acquisition_relay_requests set
    status = 'leased', leased_device_id = p_device_id,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    heartbeat_at = now(), updated_at = now()
  where id = p_request_id returning * into v_request;
  update public.acquisition_relay_devices set last_seen_at = now(), updated_at = now()
  where id = p_device_id;
  return v_request;
end;
$$;

create or replace function public.heartbeat_acquisition_relay_request(
  p_request_id uuid,
  p_device_id uuid,
  p_status text,
  p_progress_current bigint default null,
  p_progress_total bigint default null,
  p_lease_seconds integer default 120
) returns public.acquisition_relay_requests
language plpgsql
security definer
set search_path = ''
as $$
declare v_request public.acquisition_relay_requests%rowtype;
begin
  if p_status not in ('leased','downloading','uploading') then
    raise exception 'invalid_relay_progress_status' using errcode = '22023';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception 'invalid_lease_seconds' using errcode = '22023';
  end if;
  select * into v_request from public.acquisition_relay_requests where id = p_request_id for update;
  if not found or v_request.leased_device_id <> p_device_id then
    raise exception 'relay_lease_lost' using errcode = '42501';
  end if;
  if v_request.status = 'completed' then return v_request; end if;
  if v_request.status in ('cancelled','failed','expired') or v_request.expires_at <= now()
    or v_request.lease_expires_at <= now() then
    raise exception 'relay_lease_lost' using errcode = '42501';
  end if;
  if p_progress_current is not null and p_progress_total is not null
    and p_progress_current > p_progress_total then
    raise exception 'invalid_relay_progress' using errcode = '22023';
  end if;
  update public.acquisition_relay_requests set
    status = p_status,
    progress_current = coalesce(p_progress_current, progress_current),
    progress_total = coalesce(p_progress_total, progress_total),
    lease_expires_at = least(expires_at, now() + make_interval(secs => p_lease_seconds)),
    heartbeat_at = now(), updated_at = now()
  where id = p_request_id returning * into v_request;
  update public.acquisition_relay_devices set last_seen_at = now(), updated_at = now()
  where id = p_device_id;
  return v_request;
end;
$$;

create or replace function public.complete_acquisition_relay_request(
  p_request_id uuid,
  p_device_id uuid,
  p_media_asset_id uuid,
  p_checksum_sha256 text,
  p_provider_event_id text
) returns public.acquisition_relay_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.acquisition_relay_requests%rowtype;
  v_asset public.media_assets%rowtype;
  v_receipt_request_id uuid;
  v_task_id uuid := gen_random_uuid();
begin
  insert into public.acquisition_callback_receipts(provider, provider_event_id, relay_request_id)
  values ('local_relay', p_provider_event_id, p_request_id)
  on conflict (provider, provider_event_id) do nothing;
  select relay_request_id into v_receipt_request_id
  from public.acquisition_callback_receipts
  where provider = 'local_relay' and provider_event_id = p_provider_event_id;
  if v_receipt_request_id <> p_request_id then
    raise exception 'callback_event_reused' using errcode = '23505';
  end if;

  select * into v_request from public.acquisition_relay_requests where id = p_request_id for update;
  if not found then raise exception 'relay_request_not_found' using errcode = 'P0002'; end if;
  if v_request.status = 'completed' then
    if v_request.media_asset_id <> p_media_asset_id then
      raise exception 'relay_completion_mismatch' using errcode = '23505';
    end if;
    return v_request;
  end if;
  if v_request.leased_device_id <> p_device_id or v_request.lease_expires_at <= now()
    or v_request.expires_at <= now() then
    raise exception 'relay_lease_lost' using errcode = '42501';
  end if;
  if v_request.status not in ('leased','downloading','uploading') then
    raise exception 'relay_request_not_completable' using errcode = '22023';
  end if;
  if p_checksum_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_relay_checksum' using errcode = '22023';
  end if;
  select * into v_asset from public.media_assets where id = p_media_asset_id for update;
  if not found or v_asset.workspace_id <> v_request.workspace_id
    or v_asset.user_id <> v_request.user_id or v_asset.storage_bucket <> v_request.upload_bucket
    or v_asset.storage_path <> v_request.upload_path or v_asset.size_bytes > v_request.maximum_bytes
    or v_asset.checksum_sha256 <> p_checksum_sha256 then
    raise exception 'relay_asset_mismatch' using errcode = '22023';
  end if;

  update public.job_tasks set
    status = 'superseded', completed_at = coalesce(completed_at, now()),
    lease_owner = null, lease_expires_at = null, next_attempt_at = null
  where clip_job_id = v_request.clip_job_id
    and task_type in ('download_youtube_source','download_direct_source','validate_source')
    and status in ('pending','queued','leased','running','retry_wait','failed','dead_lettered');

  update public.clip_jobs set
    source_asset_id = p_media_asset_id, status = 'queued', error_code = null,
    error_message = null, completed_at = null, updated_at = now(),
    source_match_json = jsonb_build_object(
      'status','awaiting_worker_validation','connectorId','local_relay','attachedAt',now()
    )
  where id = v_request.clip_job_id and status not in ('cancelled','expiring','expired');
  if not found then raise exception 'relay_job_not_resumable' using errcode = '22023'; end if;

  insert into public.source_attachments (
    clip_job_id, connector_id, media_asset_id, youtube_video_id,
    relationship, match_confidence, match_reason
  ) values (
    v_request.clip_job_id, 'local_relay', p_media_asset_id, v_request.youtube_video_id,
    'primary', 0.500, 'Residential helper source; worker FFprobe validation is required'
  );
  insert into public.job_tasks (
    id, clip_job_id, task_type, status, priority, input_json, idempotency_key, next_attempt_at
  ) select
    v_task_id, j.id, 'validate_source', 'queued', j.priority,
    jsonb_build_object('authorisedSourceRecovery',true,'expectedDurationSeconds',j.source_duration_seconds,'connectorId','local_relay'),
    j.id::text || ':validate-local-relay:' || p_request_id::text, now()
  from public.clip_jobs j where j.id = v_request.clip_job_id
  on conflict (idempotency_key) do nothing;

  update public.acquisition_relay_requests set
    status = 'completed', checksum_sha256 = p_checksum_sha256,
    media_asset_id = p_media_asset_id, completed_at = now(), updated_at = now()
  where id = p_request_id returning * into v_request;
  update public.source_acquisition_attempts set status = 'succeeded', completed_at = now(), heartbeat_at = now()
  where id = v_request.acquisition_attempt_id and status not in ('succeeded','cancelled','superseded');
  insert into public.processing_events (
    clip_job_id, job_task_id, stage, severity, message, source_tier, acquisition_attempt_id
  ) values (
    v_request.clip_job_id, v_task_id, 'local_relay_source_received', 'info',
    'The paired device delivered the source. Secure worker validation is queued.',
    'local_relay', v_request.acquisition_attempt_id
  );
  insert into public.outbox_events(aggregate_type, aggregate_id, event_type, payload_json)
  values ('clip_job',v_request.clip_job_id,'task.queued',jsonb_build_object(
    'jobId',v_request.clip_job_id,'taskId',v_task_id,'taskType','validate_source'
  ));
  return v_request;
end;
$$;

create or replace function public.fail_acquisition_relay_request(
  p_request_id uuid,
  p_device_id uuid,
  p_error_code text,
  p_error_message text,
  p_provider_event_id text
) returns public.acquisition_relay_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.acquisition_relay_requests%rowtype;
  v_receipt_request_id uuid;
begin
  insert into public.acquisition_callback_receipts(provider, provider_event_id, relay_request_id)
  values ('local_relay', p_provider_event_id, p_request_id)
  on conflict (provider, provider_event_id) do nothing;
  select relay_request_id into v_receipt_request_id
  from public.acquisition_callback_receipts
  where provider = 'local_relay' and provider_event_id = p_provider_event_id;
  if v_receipt_request_id <> p_request_id then
    raise exception 'callback_event_reused' using errcode = '23505';
  end if;
  select * into v_request from public.acquisition_relay_requests where id = p_request_id for update;
  if not found then raise exception 'relay_request_not_found' using errcode = 'P0002'; end if;
  if v_request.status in ('completed','cancelled','expired') then return v_request; end if;
  if v_request.leased_device_id <> p_device_id then
    raise exception 'relay_lease_lost' using errcode = '42501';
  end if;
  update public.acquisition_relay_requests set
    status = 'failed', error_code = nullif(left(p_error_code,120),''),
    error_message = nullif(left(p_error_message,2000),''),
    lease_expires_at = null, updated_at = now()
  where id = p_request_id returning * into v_request;
  update public.source_acquisition_attempts set
    status = 'failed', error_code = v_request.error_code,
    error_message = v_request.error_message, completed_at = now(), heartbeat_at = now()
  where id = v_request.acquisition_attempt_id and status not in ('succeeded','cancelled','superseded');
  update public.clip_jobs set
    status = 'awaiting_authorised_source',
    error_code = coalesce(v_request.error_code,'local_relay_failed'),
    error_message = 'The paired device could not deliver this source. Attach an authorised original or owner-controlled media link to continue the same job.',
    updated_at = now()
  where id = v_request.clip_job_id and status = 'awaiting_local_relay';
  insert into public.processing_events (
    clip_job_id, job_task_id, stage, severity, message, source_tier, acquisition_attempt_id
  ) values (
    v_request.clip_job_id, v_request.job_task_id, 'local_relay_failed', 'warning',
    'The local acquisition attempt stopped. Authorised source recovery remains available.',
    'local_relay', v_request.acquisition_attempt_id
  );
  return v_request;
end;
$$;

revoke all on table public.source_acquisition_attempts from anon;
revoke all on table public.acquisition_relay_devices from anon;
revoke all on table public.acquisition_relay_pairings from anon;
revoke all on table public.acquisition_relay_requests from anon;
revoke all on table public.acquisition_callback_receipts from anon, authenticated;

revoke all on function public.record_source_acquisition_attempt(uuid,integer,text,text,integer,text,text,text) from public,anon,authenticated;
revoke all on function public.finish_source_acquisition_attempt(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.create_acquisition_relay_request(uuid,uuid,text,text,text,bigint,jsonb,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.lease_acquisition_relay_request(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.heartbeat_acquisition_relay_request(uuid,uuid,text,bigint,bigint,integer) from public,anon,authenticated;
revoke all on function public.complete_acquisition_relay_request(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.fail_acquisition_relay_request(uuid,uuid,text,text,text) from public,anon,authenticated;

grant execute on function public.record_source_acquisition_attempt(uuid,integer,text,text,integer,text,text,text) to service_role;
grant execute on function public.finish_source_acquisition_attempt(uuid,text,text,text) to service_role;
grant execute on function public.create_acquisition_relay_request(uuid,uuid,text,text,text,bigint,jsonb,uuid,timestamptz) to service_role;
grant execute on function public.lease_acquisition_relay_request(uuid,uuid,integer) to service_role;
grant execute on function public.heartbeat_acquisition_relay_request(uuid,uuid,text,bigint,bigint,integer) to service_role;
grant execute on function public.complete_acquisition_relay_request(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.fail_acquisition_relay_request(uuid,uuid,text,text,text) to service_role;

commit;
