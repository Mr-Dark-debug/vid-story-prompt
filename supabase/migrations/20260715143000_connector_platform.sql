begin;

-- Generalise the shipped encrypted OAuth store without duplicating token material.
alter table public.oauth_connections
  drop constraint if exists oauth_connections_provider_check,
  add column if not exists connector_id text,
  add column if not exists display_name text,
  add column if not exists connected_at timestamptz,
  add column if not exists last_used_at timestamptz,
  add column if not exists last_health_check_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists error_code text;

update public.oauth_connections
set connector_id=case when provider='google_youtube' then 'youtube' else provider end,
  connected_at=coalesce(connected_at,created_at),
  revoked_at=case when status='revoked' then coalesce(revoked_at,disconnected_at) else revoked_at end,
  error_code=coalesce(error_code,last_error_code)
where connector_id is null;
alter table public.oauth_connections alter column connector_id set not null;
create index if not exists oauth_connections_connector_idx on public.oauth_connections(workspace_id,connector_id,status);

create table public.connector_definitions(
  id text primary key,label text not null,category text not null,
  availability text not null check(availability in('available','beta','coming_soon','disabled')),
  capabilities text[] not null default '{}',feature_flag text,
  configuration_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

insert into public.connector_definitions(id,label,category,availability,capabilities,feature_flag) values
 ('local_upload','Upload from device','uploads','available',array['metadata','resumable_import'],null),
 ('youtube','YouTube','video_platforms','available',array['metadata','playlist','channel_automation','webhook','publish','schedule'],null),
 ('direct_url','Paste media link','direct_links','available',array['metadata','download_original'],null),
 ('rss','Podcast RSS','podcast_audio','available',array['metadata','search','download_original'],null),
 ('google_drive','Google Drive','cloud_storage','beta',array['metadata','browse','search','download_original','resumable_import'],'GOOGLE_DRIVE_CONNECTOR'),
 ('dropbox','Dropbox','cloud_storage','beta',array['metadata','browse','search','download_original','resumable_import'],'DROPBOX_CONNECTOR'),
 ('onedrive','OneDrive','cloud_storage','beta',array['metadata','browse','search','download_original','resumable_import'],'ONEDRIVE_CONNECTOR'),
 ('s3','S3-compatible storage','cloud_storage','beta',array['metadata','download_original','resumable_import','webhook'],'S3_CONNECTOR'),
 ('vimeo','Vimeo','video_platforms','beta',array['metadata','browse','search','download_original'],'VIMEO_CONNECTOR'),
 ('zoom','Zoom','recording_platforms','beta',array['metadata','browse','search','download_original','captions'],'ZOOM_CONNECTOR'),
 ('loom','Loom','recording_platforms','beta',array['metadata','browse','download_original'],'LOOM_CONNECTOR'),
 ('riverside','Riverside','recording_platforms','beta',array['metadata','browse','download_original','captions'],'RIVERSIDE_CONNECTOR'),
 ('frameio','Frame.io','cloud_storage','beta',array['metadata','browse','search','download_original'],'FRAMEIO_CONNECTOR'),
 ('box','Box','cloud_storage','beta',array['metadata','browse','search','download_original'],'BOX_CONNECTOR'),
 ('google_photos','Google Photos','cloud_storage','beta',array['metadata','browse','download_original'],'GOOGLE_PHOTOS_CONNECTOR'),
 ('other','Other source','other','available',array['metadata','download_original'],null)
on conflict(id) do update set label=excluded.label,category=excluded.category,
 availability=excluded.availability,capabilities=excluded.capabilities,
 feature_flag=excluded.feature_flag,updated_at=now();

-- This security-invoker view is the browser-safe connection representation.
-- Encrypted access and refresh tokens are intentionally absent.
create or replace view public.connector_connections with(security_invoker=true) as
select id,workspace_id,user_id,connector_id,provider_account_id,display_name,
 token_expires_at,scopes,status,error_code,connected_at,last_used_at,
 last_health_check_at,revoked_at,metadata_json,created_at,updated_at
from public.oauth_connections;

create table public.connector_imports(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 connector_connection_id uuid references public.oauth_connections(id) on delete set null,
 connector_id text not null,remote_asset_id text,remote_asset_url text,
 source_metadata_json jsonb not null default '{}'::jsonb,
 destination_asset_id uuid references public.media_assets(id) on delete set null,
 status text not null default 'queued' check(status in('queued','connecting','transferring','verifying','ready','retry_wait','failed','cancelled')),
 bytes_total bigint check(bytes_total is null or bytes_total>=0),
 bytes_transferred bigint not null default 0 check(bytes_transferred>=0),
 checksum text,attempt integer not null default 0 check(attempt>=0),
 idempotency_key uuid not null,error_code text,error_message text,
 created_at timestamptz not null default now(),started_at timestamptz,
 completed_at timestamptz,cancelled_at timestamptz,updated_at timestamptz not null default now(),
 unique(workspace_id,idempotency_key)
);

create table public.connector_waitlist(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,connector_id text not null,
 created_at timestamptz not null default now(),unique(workspace_id,user_id,connector_id)
);

create table public.source_attachments(
 id uuid primary key default gen_random_uuid(),clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
 connector_id text not null,connector_import_id uuid references public.connector_imports(id) on delete set null,
 media_asset_id uuid references public.media_assets(id) on delete restrict,youtube_video_id text,
 relationship text not null check(relationship in('primary','metadata','caption','transcript','alternate','automation_source')),
 match_confidence numeric(4,3) check(match_confidence is null or match_confidence between 0 and 1),
 match_reason text,created_at timestamptz not null default now(),
 check(media_asset_id is not null or youtube_video_id is not null or connector_import_id is not null)
);

create table public.oauth_states(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,connector_id text not null,
 state_hash text not null unique,code_verifier_encrypted text not null,return_url text not null,
 expires_at timestamptz not null,consumed_at timestamptz,created_at timestamptz not null default now()
);

create table public.connector_audit_events(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,connector_id text not null,
 event_type text not null,metadata_json jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);

create index connector_imports_active_idx on public.connector_imports(status,created_at);
create index connector_imports_workspace_idx on public.connector_imports(workspace_id,created_at desc);
create index oauth_states_expiry_idx on public.oauth_states(expires_at) where consumed_at is null;
create index source_attachments_job_idx on public.source_attachments(clip_job_id,relationship);

alter table public.connector_definitions enable row level security;
alter table public.connector_imports enable row level security;
alter table public.connector_waitlist enable row level security;
alter table public.source_attachments enable row level security;
alter table public.oauth_states enable row level security;
alter table public.connector_audit_events enable row level security;
create policy connector_definitions_select on public.connector_definitions for select to authenticated using(true);
create policy connector_imports_select on public.connector_imports for select to authenticated using(user_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy connector_imports_insert on public.connector_imports for insert to authenticated with check(user_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy connector_imports_update on public.connector_imports for update to authenticated using(user_id=auth.uid() and public.is_workspace_member(workspace_id)) with check(user_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy connector_waitlist_select on public.connector_waitlist for select to authenticated using(user_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy connector_waitlist_insert on public.connector_waitlist for insert to authenticated with check(user_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy connector_waitlist_delete on public.connector_waitlist for delete to authenticated using(user_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy source_attachments_select on public.source_attachments for select to authenticated using(exists(select 1 from public.clip_jobs j where j.id=clip_job_id and public.is_workspace_member(j.workspace_id)));
create policy source_attachments_insert on public.source_attachments for insert to authenticated with check(exists(select 1 from public.clip_jobs j where j.id=clip_job_id and j.user_id=auth.uid() and public.is_workspace_member(j.workspace_id)));
create policy connector_audit_select on public.connector_audit_events for select to authenticated using(user_id=auth.uid() and public.is_workspace_member(workspace_id));

grant select on public.connector_definitions,public.connector_connections,public.connector_imports,public.connector_waitlist,public.source_attachments,public.connector_audit_events to authenticated;
grant insert,update on public.connector_imports to authenticated;
grant insert,delete on public.connector_waitlist to authenticated;
grant insert on public.source_attachments to authenticated;
revoke all on public.oauth_states from public,anon,authenticated;
revoke all on public.connector_audit_events from public,anon,authenticated;

alter table public.plans
 add column if not exists max_connector_connections integer not null default 1 check(max_connector_connections>=0),
 add column if not exists max_automation_rules integer not null default 0 check(max_automation_rules>=0),
 add column if not exists s3_connector_enabled boolean not null default false,
 add column if not exists publishing_connections_enabled boolean not null default false,
 add column if not exists api_beta_enabled boolean not null default false;
update public.plans set
 max_connector_connections=case key when 'free' then 1 when 'creator' then 3 when 'pro' then 10 else max_connector_connections end,
 max_automation_rules=case key when 'free' then 0 when 'creator' then 3 when 'pro' then 10 else max_automation_rules end,
 s3_connector_enabled=(key='pro'),publishing_connections_enabled=(key='pro'),api_beta_enabled=(key='pro');

commit;
