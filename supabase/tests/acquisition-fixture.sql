-- Minimal isolated contract fixture, not a substitute for Supabase integration.
create role anon;
create role authenticated;
create role service_role;
create table public.clip_jobs (
  id uuid primary key, status text, error_code text, error_message text,
  updated_at timestamptz, reserved_source_seconds bigint default 60
);
create table public.job_tasks (
  id uuid primary key, clip_job_id uuid, task_type text, lease_owner text,
  status text, attempt integer, max_attempts integer, input_json jsonb default '{}',
  error_code text, error_message text, next_attempt_at timestamptz,
  lease_expires_at timestamptz, completed_at timestamptz
);
create table public.processing_events (
  clip_job_id uuid, job_task_id uuid, stage text, severity text, message text,
  attempt integer, proxy_tier text
);
create table public.publishing_jobs (
  id uuid primary key, status text, last_error_code text,
  last_error_message text, updated_at timestamptz
);
