begin;

create table if not exists public.indexnow_submissions (
  id uuid primary key default gen_random_uuid(),
  url text not null
    check (
      char_length(url) between 1 and 2048
      and url ~ '^https://vidrial[.]vercel[.]app(/[^?#]*)?$'
    ),
  fingerprint text not null
    check (fingerprint ~ '^[a-f0-9]{64}$'),
  reason text not null
    check (char_length(reason) between 1 and 64),
  response_status integer
    check (response_status is null or response_status between 100 and 599),
  attempt_count integer not null default 0
    check (attempt_count between 0 and 5),
  retry_state text not null default 'pending'
    check (retry_state in ('pending', 'submitted', 'retryable', 'terminal')),
  last_attempt_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (url, fingerprint)
);

create index if not exists indexnow_submissions_url_created_idx
  on public.indexnow_submissions(url, created_at desc);

create index if not exists indexnow_submissions_retry_idx
  on public.indexnow_submissions(retry_state, updated_at)
  where retry_state in ('pending', 'retryable');

alter table public.indexnow_submissions enable row level security;

revoke all on table public.indexnow_submissions from public, anon, authenticated;
grant select, insert, update, delete on table public.indexnow_submissions to service_role;

commit;
