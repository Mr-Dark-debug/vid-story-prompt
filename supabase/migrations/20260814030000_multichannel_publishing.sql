-- Extend the existing YouTube publishing queue for credential-gated social destinations.
-- Tokens remain encrypted in oauth_connections; this table stores only selected destination ids.

alter table public.publishing_jobs
  add column if not exists platform text not null default 'youtube',
  add column if not exists connection_id uuid references public.oauth_connections(id) on delete restrict,
  add column if not exists target_account_id text,
  add column if not exists caption text not null default '',
  add column if not exists platform_options_json jsonb not null default '{}'::jsonb,
  add column if not exists approval_mode text not null default 'review_required',
  add column if not exists approved_at timestamptz;

alter table public.publishing_jobs alter column youtube_channel_id drop not null;
alter table public.publishing_jobs drop constraint if exists publishing_jobs_title_check;
alter table public.publishing_jobs
  add constraint publishing_jobs_title_check check (char_length(title) between 1 and 2200),
  add constraint publishing_jobs_platform_check
    check (platform in ('youtube','facebook','instagram','tiktok','linkedin')),
  add constraint publishing_jobs_approval_mode_check
    check (approval_mode in ('review_required','auto_publish')),
  add constraint publishing_jobs_destination_check check (
    (platform = 'youtube' and youtube_channel_id is not null)
    or
    (platform <> 'youtube' and connection_id is not null and nullif(target_account_id,'') is not null)
  );

update public.publishing_jobs jobs
set connection_id = channels.connection_id,
    target_account_id = channels.provider_channel_id,
    approved_at = coalesce(jobs.approved_at,jobs.created_at)
from public.youtube_channels channels
where jobs.youtube_channel_id = channels.id
  and jobs.connection_id is null;

create index if not exists publishing_jobs_platform_status_idx
  on public.publishing_jobs(workspace_id,platform,status,created_at desc);

comment on column public.automation_rules.approval_mode is
  'manual is the safe default. automatic is an explicit per-rule opt-in and still requires separate publishing destination connections.';
