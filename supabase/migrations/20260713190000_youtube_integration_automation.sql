begin;

alter table public.oauth_connections
  alter column access_token_encrypted drop not null,
  add column if not exists status text not null default 'connected'
    check (status in ('connected','reconnect_required','revoked','error')),
  add column if not exists capabilities text[] not null default '{}',
  add column if not exists token_version integer not null default 1,
  add column if not exists last_refreshed_at timestamptz,
  add column if not exists last_verified_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists disconnected_at timestamptz;

drop policy if exists oauth_connections_select on public.oauth_connections;
drop policy if exists oauth_connections_insert on public.oauth_connections;
drop policy if exists oauth_connections_update on public.oauth_connections;
drop policy if exists oauth_connections_delete on public.oauth_connections;
revoke all on public.oauth_connections from authenticated;

create table public.youtube_channels (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.oauth_connections(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider_channel_id text not null,
  title text not null,
  avatar_url text,
  uploads_playlist_id text,
  selected boolean not null default true,
  last_observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_channel_id)
);

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  youtube_channel_id uuid not null references public.youtube_channels(id) on delete cascade,
  enabled boolean not null default false,
  trigger_type text not null default 'channel_upload' check (trigger_type = 'channel_upload'),
  source_behavior text not null default 'create_draft'
    check (source_behavior in ('create_draft','start_when_source_exists')),
  requested_clip_count integer not null default 5 check (requested_clip_count between 1 and 50),
  duration_range text not null default '30-60 seconds',
  caption_preset text not null default 'Clean editorial',
  content_type text not null default 'Video',
  clip_settings_json jsonb not null default '{}'::jsonb,
  publishing_behavior text not null default 'do_not_publish'
    check (publishing_behavior in ('do_not_publish','queue_for_review','schedule_approved')),
  default_privacy text not null default 'private'
    check (default_privacy in ('private','unlisted','public')),
  timezone text not null default 'UTC',
  attestation_version text,
  policy_version text,
  rights_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, youtube_channel_id)
);

create table public.youtube_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  youtube_channel_id uuid not null references public.youtube_channels(id) on delete cascade,
  hub_topic text not null,
  callback_key uuid not null default gen_random_uuid(),
  secret_hash text not null,
  status text not null default 'pending'
    check (status in ('pending','verified','renewing','expired','failed','disabled')),
  lease_expires_at timestamptz,
  last_renewal_attempt_at timestamptz,
  verified_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (youtube_channel_id)
);

create table public.automation_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  youtube_channel_id uuid not null references public.youtube_channels(id) on delete cascade,
  automation_rule_id uuid references public.automation_rules(id) on delete set null,
  provider_event_key text not null unique,
  provider_video_id text not null,
  event_kind text not null check (event_kind in ('upload','metadata_update')),
  payload_json jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('received','draft_created','job_created','ignored','failed')),
  automation_draft_id uuid,
  clip_job_id uuid references public.clip_jobs(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text
);

create table public.automation_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  automation_rule_id uuid references public.automation_rules(id) on delete set null,
  youtube_channel_id uuid not null references public.youtube_channels(id) on delete cascade,
  provider_video_id text not null,
  source_asset_id uuid references public.media_assets(id) on delete set null,
  clip_job_id uuid references public.clip_jobs(id) on delete set null,
  title text not null,
  description text,
  thumbnail_url text,
  duration_seconds bigint check (duration_seconds is null or duration_seconds > 0),
  published_at timestamptz,
  proposed_settings_json jsonb not null default '{}'::jsonb,
  status text not null default 'awaiting_source'
    check (status in ('awaiting_source','ready','job_created','dismissed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider_video_id)
);

alter table public.automation_events
  add constraint automation_events_draft_fk foreign key (automation_draft_id)
  references public.automation_drafts(id) on delete set null;

create table public.youtube_asset_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  youtube_channel_id uuid not null references public.youtube_channels(id) on delete cascade,
  provider_video_id text not null,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  provenance text not null check (provenance in ('vidrial_publish','user_attached')),
  created_at timestamptz not null default now(),
  unique (workspace_id, provider_video_id),
  unique (youtube_channel_id, media_asset_id)
);

create table public.publishing_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
  export_id uuid not null references public.exports(id) on delete cascade,
  youtube_channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 5000),
  tags text[] not null default '{}',
  category_id text not null default '22',
  made_for_kids boolean not null,
  privacy_status text not null default 'private'
    check (privacy_status in ('private','unlisted','public')),
  scheduled_for timestamptz,
  status text not null default 'queued'
    check (status in ('scheduled','queued','uploading','processing','published','retry_wait','reconnect_required','failed','cancelled')),
  idempotency_key uuid not null unique,
  provider_video_id text,
  provider_video_url text,
  resumable_session_encrypted text,
  attempt integer not null default 0,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

update public.oauth_connections
set capabilities = case
  when scopes @> array['https://www.googleapis.com/auth/youtube.upload']::text[]
    then array['channel_read','video_publish']::text[]
  when scopes @> array['https://www.googleapis.com/auth/youtube.readonly']::text[]
    then array['channel_read']::text[]
  else '{}'::text[]
end,
status = case when access_token_encrypted is null then 'reconnect_required' else 'connected' end,
last_verified_at = coalesce(last_verified_at,updated_at)
where provider = 'google_youtube';

insert into public.youtube_channels(
  connection_id,workspace_id,user_id,provider_channel_id,title,selected,last_observed_at
)
select c.id,c.workspace_id,c.user_id,item->>'id',coalesce(item->>'title','YouTube channel'),ordinality=1,c.updated_at
from public.oauth_connections c
cross join lateral jsonb_array_elements(coalesce(c.metadata_json->'channels','[]'::jsonb)) with ordinality as channels(item,ordinality)
where c.provider='google_youtube' and nullif(item->>'id','') is not null
on conflict(connection_id,provider_channel_id) do nothing;

create index youtube_channels_workspace_idx on public.youtube_channels(workspace_id, selected);
create index automation_rules_enabled_idx on public.automation_rules(enabled, youtube_channel_id);
create index youtube_subscriptions_renewal_idx on public.youtube_subscriptions(status, lease_expires_at);
create index automation_events_video_idx on public.automation_events(youtube_channel_id, provider_video_id);
create index automation_drafts_status_idx on public.automation_drafts(workspace_id, status, created_at desc);
create index publishing_jobs_due_idx on public.publishing_jobs(status, scheduled_for);

alter table public.youtube_channels enable row level security;
alter table public.automation_rules enable row level security;
alter table public.youtube_subscriptions enable row level security;
alter table public.automation_events enable row level security;
alter table public.automation_drafts enable row level security;
alter table public.youtube_asset_links enable row level security;
alter table public.publishing_jobs enable row level security;

create policy youtube_channels_select on public.youtube_channels for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy automation_rules_select on public.automation_rules for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy automation_rules_insert on public.automation_rules for insert to authenticated
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy automation_rules_update on public.automation_rules for update to authenticated
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy automation_rules_delete on public.automation_rules for delete to authenticated
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy youtube_subscriptions_select on public.youtube_subscriptions for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy automation_events_select on public.automation_events for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy automation_drafts_select on public.automation_drafts for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy automation_drafts_update on public.automation_drafts for update to authenticated
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy youtube_asset_links_select on public.youtube_asset_links for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy youtube_asset_links_insert on public.youtube_asset_links for insert to authenticated
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy publishing_jobs_select on public.publishing_jobs for select to authenticated
  using (public.is_workspace_member(workspace_id));

grant select on public.youtube_channels, public.automation_rules, public.youtube_subscriptions,
  public.automation_events, public.automation_drafts, public.youtube_asset_links,
  public.publishing_jobs to authenticated;
grant insert, update, delete on public.automation_rules to authenticated;
grant update on public.automation_drafts to authenticated;
grant insert on public.youtube_asset_links to authenticated;

create or replace function public.create_automated_clip_job(
  p_rule_id uuid,
  p_draft_id uuid,
  p_source_asset_id uuid,
  p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_rule public.automation_rules%rowtype;
  v_draft public.automation_drafts%rowtype;
  v_asset public.media_assets%rowtype;
  v_channel public.youtube_channels%rowtype;
  v_plan public.plans%rowtype;
  v_period public.usage_periods%rowtype;
  v_job_id uuid;
  v_duration bigint;
  v_active_jobs integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  select * into v_rule from public.automation_rules where id = p_rule_id for update;
  select * into v_draft from public.automation_drafts where id = p_draft_id for update;
  select * into v_asset from public.media_assets where id = p_source_asset_id;
  select * into v_channel from public.youtube_channels where id = v_rule.youtube_channel_id;
  if v_draft.clip_job_id is not null then return v_draft.clip_job_id; end if;
  if v_rule.id is null or v_draft.id is null or v_asset.id is null or v_channel.id is null
    or not v_rule.enabled or v_rule.source_behavior <> 'start_when_source_exists'
    or v_rule.rights_accepted_at is null or v_rule.attestation_version is null
    or v_rule.policy_version is null then
    raise exception 'automation_rule_not_authorised' using errcode = '22023';
  end if;
  if v_draft.automation_rule_id <> v_rule.id or v_asset.workspace_id <> v_rule.workspace_id
    or v_asset.user_id <> v_rule.user_id or v_channel.workspace_id <> v_rule.workspace_id then
    raise exception 'automation_source_mismatch' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.youtube_asset_links l
    where l.workspace_id = v_rule.workspace_id and l.youtube_channel_id = v_channel.id
      and l.provider_video_id = v_draft.provider_video_id and l.media_asset_id = v_asset.id
  ) then raise exception 'explicit_source_mapping_required' using errcode = '22023'; end if;
  v_duration := ceil(coalesce(v_asset.duration_seconds,v_draft.duration_seconds,0));
  if v_duration <= 0 then raise exception 'source_duration_required' using errcode = '22023'; end if;
  select p.* into v_plan from public.profiles pr join public.plans p on p.key = pr.plan_key
  where pr.id = v_rule.user_id and p.active;
  if not found or v_duration > v_plan.max_source_seconds_per_job
    or v_rule.requested_clip_count > v_plan.max_clips_per_job then
    raise exception 'plan_limit_exceeded' using errcode = '22023';
  end if;
  select count(*) into v_active_jobs from public.clip_jobs
  where workspace_id = v_rule.workspace_id and status not in ('completed','failed','cancelled','expired');
  if v_active_jobs >= v_plan.max_concurrent_jobs then
    raise exception 'concurrent_job_limit_exceeded' using errcode = '22023';
  end if;
  insert into public.usage_periods(workspace_id,plan_key,period_start,period_end,source_seconds_limit)
  values(v_rule.workspace_id,v_plan.key,date_trunc('month',now()),date_trunc('month',now())+interval '1 month',v_plan.monthly_source_seconds)
  on conflict(workspace_id,period_start) do update set updated_at=now() returning * into v_period;
  perform 1 from public.usage_periods where id=v_period.id for update;
  select * into v_period from public.usage_periods where id=v_period.id;
  if v_period.source_seconds_reserved + v_period.source_seconds_committed + v_duration > v_period.source_seconds_limit then
    raise exception 'insufficient_usage' using errcode = '22023';
  end if;
  update public.usage_periods set source_seconds_reserved=source_seconds_reserved+v_duration,updated_at=now() where id=v_period.id;
  insert into public.clip_jobs(
    workspace_id,user_id,source_asset_id,source_type,source_url,youtube_video_id,source_title,
    source_channel_id,source_channel_title,source_thumbnail_url,source_duration_seconds,content_type,
    target_platforms,aspect_ratios,settings_json,requested_clip_count,status,priority,reserved_source_seconds,
    watermark_required,export_limit_json,retention_expires_at
  ) values(
    v_rule.workspace_id,v_rule.user_id,v_asset.id,'youtube_connected_channel',
    'https://www.youtube.com/watch?v='||v_draft.provider_video_id,v_draft.provider_video_id,v_draft.title,
    v_channel.provider_channel_id,v_channel.title,v_draft.thumbnail_url,v_duration,v_rule.content_type,
    array['youtube_shorts'],array['9:16'],
    v_rule.clip_settings_json || jsonb_build_object('durationRange',v_rule.duration_range,'captionPreset',v_rule.caption_preset),
    v_rule.requested_clip_count,'queued',v_plan.priority,v_duration,v_plan.watermark_required,
    jsonb_build_object('width',v_plan.max_export_width,'height',v_plan.max_export_height,'fps',v_plan.max_export_fps),
    now()+make_interval(days=>v_plan.retention_days)
  ) returning id into v_job_id;
  insert into public.rights_attestations(
    workspace_id,user_id,clip_job_id,source_url,source_identifier,attestation_version,policy_version,accepted_at,request_metadata_json
  ) values(
    v_rule.workspace_id,v_rule.user_id,v_job_id,'https://www.youtube.com/watch?v='||v_draft.provider_video_id,
    v_draft.provider_video_id,v_rule.attestation_version,v_rule.policy_version,v_rule.rights_accepted_at,
    jsonb_build_object('client','youtube_automation','ruleId',v_rule.id,'draftId',v_draft.id)
  );
  insert into public.usage_ledger(workspace_id,user_id,job_id,category,amount,unit,direction,state,idempotency_key,description)
  values(v_rule.workspace_id,v_rule.user_id,v_job_id,'source_analysis',v_duration,'seconds','debit','reserved',p_idempotency_key::text||':usage','Automated source seconds reserved');
  insert into public.job_tasks(clip_job_id,task_type,status,priority,idempotency_key,next_attempt_at)
  values(v_job_id,'validate_source','queued',v_plan.priority,p_idempotency_key::text||':validate',now());
  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload_json)
  values('clip_job',v_job_id,'task.queued',jsonb_build_object('jobId',v_job_id,'taskType','validate_source'));
  update public.automation_drafts set source_asset_id=v_asset.id,clip_job_id=v_job_id,status='job_created',updated_at=now()
  where id=v_draft.id;
  return v_job_id;
end;
$$;

revoke all on function public.create_automated_clip_job(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_automated_clip_job(uuid,uuid,uuid,uuid) to service_role;

commit;
