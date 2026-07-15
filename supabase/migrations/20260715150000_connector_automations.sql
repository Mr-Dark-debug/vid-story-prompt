begin;

alter table public.automation_rules
  add column if not exists connector_id text not null default 'youtube',
  add column if not exists connector_connection_id uuid references public.oauth_connections(id) on delete set null,
  add column if not exists remote_collection_id text,
  add column if not exists remote_collection_label text,
  add column if not exists minimum_duration_seconds integer check(minimum_duration_seconds is null or minimum_duration_seconds>=0),
  add column if not exists maximum_duration_seconds integer check(maximum_duration_seconds is null or maximum_duration_seconds>0),
  add column if not exists aspect_ratio text not null default '9:16',
  add column if not exists brand_preset_id uuid,
  add column if not exists language text not null default 'auto',
  add column if not exists excluded_keywords text[] not null default '{}',
  add column if not exists publishing_destination_ids uuid[] not null default '{}',
  add column if not exists approval_mode text not null default 'manual' check(approval_mode in('manual','automatic')),
  add column if not exists monthly_usage_ceiling_seconds bigint check(monthly_usage_ceiling_seconds is null or monthly_usage_ceiling_seconds>0),
  add column if not exists trigger_configuration_json jsonb not null default '{}'::jsonb;

alter table public.automation_rules drop constraint if exists automation_rules_trigger_type_check;
alter table public.automation_rules add constraint automation_rules_trigger_type_check
  check(trigger_type in('channel_upload','folder_item','cloud_recording','recording_export','rss_episode','object_prefix'));

create table public.automation_source_runs(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  automation_rule_id uuid not null references public.automation_rules(id) on delete cascade,
  connector_id text not null,remote_asset_id text not null,remote_version_id text not null default '',
  connector_import_id uuid references public.connector_imports(id) on delete set null,
  clip_job_id uuid references public.clip_jobs(id) on delete set null,
  status text not null check(status in('observed','queued','importing','processing','ready','ignored','failed')),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(automation_rule_id,remote_asset_id,remote_version_id)
);
alter table public.automation_source_runs enable row level security;
create policy automation_source_runs_select on public.automation_source_runs for select to authenticated using(public.is_workspace_member(workspace_id));
grant select on public.automation_source_runs to authenticated;

commit;
