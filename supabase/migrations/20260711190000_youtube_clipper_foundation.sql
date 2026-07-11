begin;

create extension if not exists pgcrypto;
create schema if not exists pgmq;
create extension if not exists pgmq with schema pgmq;

create table public.plans (
  key text primary key,
  name text not null,
  monthly_source_seconds bigint not null check (monthly_source_seconds >= 0),
  max_source_seconds_per_job bigint not null check (max_source_seconds_per_job > 0),
  max_clips_per_job integer not null check (max_clips_per_job > 0),
  max_concurrent_jobs integer not null check (max_concurrent_jobs > 0),
  max_export_height integer not null,
  max_export_width integer not null,
  max_export_fps integer not null,
  watermark_required boolean not null,
  trial_unwatermarked_exports integer not null default 0,
  retention_days integer not null,
  max_reprompts_per_job integer not null,
  brand_preset_limit integer not null,
  priority integer not null,
  active boolean not null default true
);

insert into public.plans values
  ('free', 'Free', 3600, 1800, 5, 1, 720, 1280, 30, true, 1, 7, 1, 0, 10, true),
  ('creator', 'Creator', 36000, 7200, 20, 2, 1080, 1920, 30, false, 0, 30, 5, 1, 20, true),
  ('pro', 'Pro', 108000, 21600, 50, 4, 2160, 3840, 60, false, 0, 90, 20, 5, 30, true)
on conflict (key) do update set
  name = excluded.name,
  monthly_source_seconds = excluded.monthly_source_seconds,
  max_source_seconds_per_job = excluded.max_source_seconds_per_job,
  max_clips_per_job = excluded.max_clips_per_job,
  max_concurrent_jobs = excluded.max_concurrent_jobs,
  max_export_height = excluded.max_export_height,
  max_export_width = excluded.max_export_width,
  max_export_fps = excluded.max_export_fps,
  watermark_required = excluded.watermark_required,
  trial_unwatermarked_exports = excluded.trial_unwatermarked_exports,
  retention_days = excluded.retention_days,
  max_reprompts_per_job = excluded.max_reprompts_per_job,
  brand_preset_limit = excluded.brand_preset_limit,
  priority = excluded.priority,
  active = excluded.active;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  plan_key text not null default 'free' references public.plans(key),
  trial_unwatermarked_exports_used integer not null default 0 check (trial_unwatermarked_exports_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = target_workspace_id and w.owner_id = auth.uid()
  ) or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id and wm.user_id = auth.uid()
  );
$$;

create table public.usage_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_key text not null references public.plans(key),
  period_start timestamptz not null,
  period_end timestamptz not null,
  source_seconds_limit bigint not null,
  source_seconds_reserved bigint not null default 0 check (source_seconds_reserved >= 0),
  source_seconds_committed bigint not null default 0 check (source_seconds_committed >= 0),
  generation_credits_limit bigint not null default 0,
  generation_credits_reserved bigint not null default 0 check (generation_credits_reserved >= 0),
  generation_credits_committed bigint not null default 0 check (generation_credits_committed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, period_start)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  project_id text,
  source_type text not null check (source_type in ('local_upload','direct_owned_media_url','youtube_metadata','youtube_connected_channel','google_drive')),
  storage_bucket text,
  storage_path text,
  original_filename text,
  display_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  checksum_sha256 text,
  duration_seconds numeric check (duration_seconds >= 0),
  width integer,
  height integer,
  frame_rate numeric,
  video_codec text,
  audio_codec text,
  has_audio boolean,
  status text not null default 'pending',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (storage_bucket, storage_path)
);

create table public.clip_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  project_id text,
  source_asset_id uuid references public.media_assets(id),
  source_type text not null check (source_type in ('local_upload','direct_owned_media_url','youtube_metadata','youtube_connected_channel','google_drive')),
  source_url text,
  youtube_video_id text,
  source_title text,
  source_channel_id text,
  source_channel_title text,
  source_thumbnail_url text,
  source_duration_seconds bigint check (source_duration_seconds >= 0),
  source_language text,
  content_type text,
  target_platforms text[] not null default '{}',
  aspect_ratios text[] not null default '{}',
  settings_json jsonb not null default '{}'::jsonb,
  requested_clip_count integer not null default 5,
  completed_clip_count integer not null default 0,
  status text not null default 'draft' check (status in ('draft','awaiting_source','uploading','queued','validating','creating_proxy','extracting_audio','transcribing','analysing','planning','rendering_previews','ready','partially_ready','exporting','completed','failed','cancelled','expiring','expired')),
  priority integer not null default 10,
  reserved_source_seconds bigint not null default 0,
  committed_source_seconds bigint not null default 0,
  watermark_required boolean not null,
  export_limit_json jsonb not null,
  retention_expires_at timestamptz not null,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  job_id uuid references public.clip_jobs(id),
  category text not null check (category in ('source_analysis','transcription','clip_planning','render_preview','render_export','generation')),
  amount bigint not null check (amount >= 0),
  unit text not null,
  direction text not null check (direction in ('debit','credit')),
  state text not null check (state in ('reserved','committed','released')),
  idempotency_key text not null unique,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.rights_attestations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  clip_job_id uuid not null unique references public.clip_jobs(id) on delete cascade,
  source_url text,
  source_identifier text,
  attestation_version text not null,
  policy_version text not null,
  accepted_at timestamptz not null,
  request_metadata_json jsonb not null default '{}'::jsonb
);

create table public.job_tasks (
  id uuid primary key default gen_random_uuid(),
  clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
  task_type text not null,
  status text not null default 'pending' check (status in ('pending','queued','leased','running','retry_wait','succeeded','failed','cancelled','dead_lettered')),
  priority integer not null default 10,
  dependency_group text,
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  attempt integer not null default 0,
  max_attempts integer not null default 5,
  idempotency_key text not null unique,
  lease_owner text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  next_attempt_at timestamptz,
  progress_current bigint,
  progress_total bigint,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table public.processing_events (
  id uuid primary key default gen_random_uuid(),
  clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
  job_task_id uuid references public.job_tasks(id) on delete set null,
  stage text not null,
  severity text not null check (severity in ('debug','info','warning','error')),
  message text not null,
  progress_current bigint,
  progress_total bigint,
  correlation_id uuid not null default gen_random_uuid(),
  provider text,
  attempt integer,
  created_at timestamptz not null default now()
);

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id),
  language text,
  provider text not null,
  model text not null,
  duration_seconds numeric,
  text text not null default '',
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  sequence integer not null,
  speaker_key text,
  start_seconds numeric not null,
  end_seconds numeric not null,
  text text not null,
  confidence numeric,
  words_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (transcript_id, sequence)
);

create table public.planning_runs (
  id uuid primary key default gen_random_uuid(),
  clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
  provider text not null,
  model text not null,
  prompt_version text not null,
  schema_version text not null,
  status text not null,
  input_token_count integer,
  output_token_count integer,
  estimated_cost numeric,
  latency_ms integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.clip_candidates (
  id uuid primary key default gen_random_uuid(),
  clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
  planning_run_id uuid not null references public.planning_runs(id) on delete cascade,
  start_seconds numeric not null,
  end_seconds numeric not null,
  title text not null,
  hook text not null,
  summary text not null,
  topic text not null,
  transcript_excerpt text not null,
  standalone_score numeric not null,
  hook_score numeric not null,
  clarity_score numeric not null,
  story_score numeric not null,
  relevance_score numeric not null,
  technical_score numeric not null,
  overall_score numeric not null,
  selection_reason text not null,
  overlap_group text,
  rank integer,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_seconds > start_seconds)
);

create table public.clips (
  id uuid primary key default gen_random_uuid(),
  clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
  clip_candidate_id uuid references public.clip_candidates(id),
  current_version_id uuid,
  title text not null,
  status text not null,
  selected boolean not null default true,
  duration_seconds numeric not null,
  preview_asset_id uuid references public.media_assets(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.clip_versions (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references public.clips(id) on delete cascade,
  version_number integer not null,
  created_by uuid not null references public.profiles(id),
  created_source text not null check (created_source in ('ai','manual','restore','duplicate')),
  edit_manifest_json jsonb not null,
  transcript_edits_json jsonb not null default '{}'::jsonb,
  caption_settings_json jsonb not null default '{}'::jsonb,
  crop_settings_json jsonb not null default '{}'::jsonb,
  audio_settings_json jsonb not null default '{}'::jsonb,
  text_overlays_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (clip_id, version_number)
);

alter table public.clips add constraint clips_current_version_fk foreign key (current_version_id) references public.clip_versions(id);

create table public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
  clip_id uuid references public.clips(id) on delete cascade,
  clip_version_id uuid references public.clip_versions(id),
  render_type text not null,
  status text not null,
  settings_json jsonb not null,
  watermark_required boolean not null,
  output_asset_id uuid references public.media_assets(id),
  attempt integer not null default 0,
  idempotency_key text not null unique,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
  clip_id uuid references public.clips(id),
  render_job_id uuid references public.render_jobs(id),
  export_type text not null,
  format text not null,
  resolution text not null,
  frame_rate numeric not null,
  caption_mode text not null,
  watermarked boolean not null,
  storage_bucket text,
  storage_path text,
  size_bytes bigint,
  checksum_sha256 text,
  status text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.provider_runs (
  id uuid primary key default gen_random_uuid(),
  clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
  job_task_id uuid references public.job_tasks(id) on delete set null,
  provider text not null,
  model text not null,
  feature text not null,
  request_id text,
  status text not null,
  input_units bigint,
  output_units bigint,
  estimated_cost numeric,
  latency_ms integer,
  retry_count integer not null default 0,
  error_category text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload_json jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','processed','failed')),
  attempt integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index clip_jobs_workspace_status_idx on public.clip_jobs(workspace_id, status);
create index job_tasks_claim_idx on public.job_tasks(status, next_attempt_at, priority, created_at);
create index processing_events_job_created_idx on public.processing_events(clip_job_id, created_at);
create index outbox_pending_idx on public.outbox_events(status, next_attempt_at);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare new_workspace_id uuid;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'User'), '@', 1)));
  insert into public.workspaces (name, owner_id)
  values (coalesce(new.raw_user_meta_data ->> 'display_name', 'My workspace'), new.id)
  returning id into new_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.create_clip_job(
  p_workspace_id uuid,
  p_source_type text,
  p_source_url text,
  p_source_identifier text,
  p_source_duration_seconds bigint,
  p_source_asset_id uuid,
  p_source_metadata jsonb,
  p_settings jsonb,
  p_requested_clip_count integer,
  p_attestation_version text,
  p_policy_version text,
  p_request_metadata jsonb,
  p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_period public.usage_periods%rowtype;
  v_job_id uuid;
  v_active_jobs integer;
begin
  if v_user_id is null or not public.is_workspace_member(p_workspace_id) then
    raise exception 'workspace_access_denied' using errcode = '42501';
  end if;
  if p_attestation_version is null or p_source_duration_seconds is null or p_source_duration_seconds <= 0 then
    raise exception 'invalid_job_request' using errcode = '22023';
  end if;
  select p.* into v_plan from public.profiles pr join public.plans p on p.key = pr.plan_key where pr.id = v_user_id and p.active;
  if not found or p_source_duration_seconds > v_plan.max_source_seconds_per_job or p_requested_clip_count > v_plan.max_clips_per_job then
    raise exception 'plan_limit_exceeded' using errcode = '22023';
  end if;
  select count(*) into v_active_jobs from public.clip_jobs
  where workspace_id = p_workspace_id and status not in ('completed','failed','cancelled','expired');
  if v_active_jobs >= v_plan.max_concurrent_jobs then
    raise exception 'concurrent_job_limit_exceeded' using errcode = '22023';
  end if;
  insert into public.usage_periods (
    workspace_id, plan_key, period_start, period_end, source_seconds_limit
  ) values (
    p_workspace_id, v_plan.key, date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', v_plan.monthly_source_seconds
  ) on conflict (workspace_id, period_start) do update set updated_at = now()
  returning * into v_period;
  perform 1 from public.usage_periods where id = v_period.id for update;
  select * into v_period from public.usage_periods where id = v_period.id;
  if v_period.source_seconds_reserved + v_period.source_seconds_committed + p_source_duration_seconds > v_period.source_seconds_limit then
    raise exception 'insufficient_usage' using errcode = '22023';
  end if;
  update public.usage_periods set source_seconds_reserved = source_seconds_reserved + p_source_duration_seconds, updated_at = now() where id = v_period.id;
  insert into public.clip_jobs (
    workspace_id, user_id, source_asset_id, source_type, source_url, youtube_video_id, source_title,
    source_channel_id, source_channel_title, source_thumbnail_url, source_duration_seconds, settings_json,
    requested_clip_count, status, priority, reserved_source_seconds, watermark_required, export_limit_json,
    retention_expires_at
  ) values (
    p_workspace_id, v_user_id, p_source_asset_id, p_source_type, p_source_url, p_source_identifier,
    p_source_metadata ->> 'title', p_source_metadata ->> 'channelId', p_source_metadata ->> 'channelTitle',
    p_source_metadata ->> 'thumbnailUrl', p_source_duration_seconds, p_settings, p_requested_clip_count,
    case when p_source_asset_id is null then 'awaiting_source' else 'queued' end, v_plan.priority,
    p_source_duration_seconds, v_plan.watermark_required,
    jsonb_build_object('width', v_plan.max_export_width, 'height', v_plan.max_export_height, 'fps', v_plan.max_export_fps),
    now() + make_interval(days => v_plan.retention_days)
  ) returning id into v_job_id;
  insert into public.rights_attestations values (
    gen_random_uuid(), p_workspace_id, v_user_id, v_job_id, p_source_url, p_source_identifier,
    p_attestation_version, p_policy_version, now(), coalesce(p_request_metadata, '{}'::jsonb)
  );
  insert into public.usage_ledger (workspace_id,user_id,job_id,category,amount,unit,direction,state,idempotency_key,description)
  values (p_workspace_id,v_user_id,v_job_id,'source_analysis',p_source_duration_seconds,'seconds','debit','reserved',p_idempotency_key || ':usage','Source seconds reserved');
  if p_source_asset_id is not null then
    insert into public.job_tasks (clip_job_id,task_type,status,priority,idempotency_key,next_attempt_at)
    values (v_job_id,'validate_source','queued',v_plan.priority,p_idempotency_key || ':validate',now());
    insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload_json)
    values ('clip_job',v_job_id,'task.queued',jsonb_build_object('jobId',v_job_id,'taskType','validate_source'));
  end if;
  return v_job_id;
end;
$$;

create or replace function public.consume_trial_export(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles%rowtype; v_plan public.plans%rowtype;
begin
  select pr.* into v_profile from public.profiles pr join public.clip_jobs j on j.user_id = pr.id
  where j.id = p_job_id and j.user_id = auth.uid() for update;
  if not found then raise exception 'job_access_denied' using errcode = '42501'; end if;
  select * into v_plan from public.plans where key = v_profile.plan_key;
  if not v_plan.watermark_required then return true; end if;
  if v_profile.trial_unwatermarked_exports_used < v_plan.trial_unwatermarked_exports then
    update public.profiles set trial_unwatermarked_exports_used = trial_unwatermarked_exports_used + 1, updated_at = now() where id = v_profile.id;
    return true;
  end if;
  return false;
end;
$$;

alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.usage_periods enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.media_assets enable row level security;
alter table public.clip_jobs enable row level security;
alter table public.rights_attestations enable row level security;
alter table public.job_tasks enable row level security;
alter table public.processing_events enable row level security;
alter table public.transcripts enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.planning_runs enable row level security;
alter table public.clip_candidates enable row level security;
alter table public.clips enable row level security;
alter table public.clip_versions enable row level security;
alter table public.render_jobs enable row level security;
alter table public.exports enable row level security;
alter table public.provider_runs enable row level security;
alter table public.outbox_events enable row level security;

create policy plans_select on public.plans for select to authenticated using (active);
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and plan_key = (select plan_key from public.profiles where id = auth.uid()));
create policy workspaces_select on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_insert on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
create policy workspaces_update on public.workspaces for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy workspaces_delete on public.workspaces for delete to authenticated using (owner_id = auth.uid());
create policy members_select on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy members_insert on public.workspace_members for insert to authenticated with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));
create policy members_update on public.workspace_members for update to authenticated using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));
create policy members_delete on public.workspace_members for delete to authenticated using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array['usage_periods','usage_ledger','media_assets','clip_jobs','rights_attestations','exports'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))', table_name || '_select', table_name);
  end loop;
end $$;

create policy media_assets_insert on public.media_assets for insert to authenticated with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy media_assets_update on public.media_assets for update to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id)) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy media_assets_delete on public.media_assets for delete to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy clip_jobs_update on public.clip_jobs for update to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id)) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy clip_jobs_delete on public.clip_jobs for delete to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy exports_insert on public.exports for insert to authenticated with check (
  user_id = auth.uid() and public.is_workspace_member(workspace_id) and
  exists (select 1 from public.clips c join public.clip_jobs j on j.id = c.clip_job_id where c.id = clip_id and j.workspace_id = workspace_id)
);
create policy exports_update on public.exports for update to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy exports_delete on public.exports for delete to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

do $$
declare item record;
begin
  for item in select * from (values
    ('job_tasks','clip_job_id'),('processing_events','clip_job_id'),('transcripts','clip_job_id'),
    ('planning_runs','clip_job_id'),('clip_candidates','clip_job_id'),('clips','clip_job_id'),
    ('render_jobs','clip_job_id'),('provider_runs','clip_job_id')) as t(table_name, job_column)
  loop
    execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.clip_jobs j where j.id = %I and public.is_workspace_member(j.workspace_id)))', item.table_name || '_select', item.table_name, item.job_column);
  end loop;
end $$;

create policy transcript_segments_select on public.transcript_segments for select to authenticated using (exists (
  select 1 from public.transcripts t join public.clip_jobs j on j.id = t.clip_job_id where t.id = transcript_id and public.is_workspace_member(j.workspace_id)
));
create policy clip_versions_select on public.clip_versions for select to authenticated using (exists (
  select 1 from public.clips c join public.clip_jobs j on j.id = c.clip_job_id where c.id = clip_id and public.is_workspace_member(j.workspace_id)
));
create policy clip_versions_insert on public.clip_versions for insert to authenticated with check (created_by = auth.uid() and exists (
  select 1 from public.clips c join public.clip_jobs j on j.id = c.clip_job_id where c.id = clip_id and public.is_workspace_member(j.workspace_id)
));

insert into storage.buckets (id,name,public,file_size_limit) values
  ('source-media','source-media',false,10737418240),
  ('source-proxies','source-proxies',false,5368709120),
  ('audio-artifacts','audio-artifacts',false,2147483648),
  ('clip-previews','clip-previews',false,1073741824),
  ('clip-exports','clip-exports',false,5368709120),
  ('caption-assets','caption-assets',false,104857600),
  ('brand-assets','brand-assets',false,104857600),
  ('job-artifacts','job-artifacts',false,1073741824)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create or replace function public.storage_object_allowed(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when array_length(storage.foldername(object_name), 1) >= 2
      and (storage.foldername(object_name))[2] = auth.uid()::text
      and (storage.foldername(object_name))[1] ~* '^[0-9a-f-]{36}$'
    then public.is_workspace_member(((storage.foldername(object_name))[1])::uuid)
    else false
  end;
$$;

create policy storage_select on storage.objects for select to authenticated using (public.storage_object_allowed(name));
create policy storage_insert on storage.objects for insert to authenticated with check (public.storage_object_allowed(name));
create policy storage_update on storage.objects for update to authenticated using (public.storage_object_allowed(name)) with check (public.storage_object_allowed(name));
create policy storage_delete on storage.objects for delete to authenticated using (public.storage_object_allowed(name));

grant execute on function public.create_clip_job to authenticated;
grant execute on function public.consume_trial_export to authenticated;

commit;
