-- Bring-your-own-key AI layer: encrypted provider credentials, model cache, preferences,
-- persistent chat and durable AI runs.
--
-- Security model
--  * Ciphertext (key_encrypted) is never selectable by browser roles. Column-level grants expose
--    only non-secret columns, and ai_provider_connections is the browser-facing, token-free view.
--  * Every mutation that touches secrets, message status, usage or run state happens in trusted
--    server code with the service role. Browser roles get read access (RLS-scoped to the owner)
--    plus a few narrowly granted columns on threads, preferences and settings.
--  * Provider ids are validated by shape only; src/domain/ai/providers.ts is the single registry.
begin;

create or replace function public.ai_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Credentials
-- ---------------------------------------------------------------------------------------------
create table public.ai_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider_id text not null check (provider_id ~ '^[a-z][a-z0-9_]{1,31}$'),
  label text not null check (char_length(label) between 1 and 60),
  key_encrypted text,
  key_version text check (key_version is null or key_version ~ '^[A-Za-z0-9_-]{1,16}$'),
  key_last4 text not null check (char_length(key_last4) between 1 and 4),
  status text not null default 'active' check (status in ('active', 'invalid', 'revoked')),
  last_verified_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Revoking wipes the ciphertext so a revoked key cannot be recovered from the database.
  constraint ai_credentials_key_present check (
    status = 'revoked' or (key_encrypted is not null and key_version is not null)
  ),
  constraint ai_credentials_unique_label unique (workspace_id, user_id, provider_id, label)
);
create index ai_provider_credentials_owner_idx
  on public.ai_provider_credentials (workspace_id, user_id, provider_id);
create trigger ai_provider_credentials_touch before update on public.ai_provider_credentials
  for each row execute function public.ai_touch_updated_at();

alter table public.ai_provider_credentials enable row level security;
create policy ai_credentials_select on public.ai_provider_credentials
  for select to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));

revoke all on public.ai_provider_credentials from public, anon, authenticated;
grant select (
  id, workspace_id, user_id, provider_id, label, key_last4, status,
  last_verified_at, last_error_code, created_at, updated_at
) on public.ai_provider_credentials to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Model cache (refreshed on demand and on a TTL by server code)
-- ---------------------------------------------------------------------------------------------
create table public.ai_model_cache (
  credential_id uuid primary key references public.ai_provider_credentials(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  models_json jsonb not null default '[]'::jsonb,
  model_count integer not null default 0 check (model_count between 0 and 3000),
  fetched_at timestamptz not null default now(),
  constraint ai_model_cache_is_bounded_array check (
    jsonb_typeof(models_json) = 'array' and jsonb_array_length(models_json) <= 3000
  )
);
alter table public.ai_model_cache enable row level security;
create policy ai_model_cache_select on public.ai_model_cache
  for select to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
revoke all on public.ai_model_cache from public, anon, authenticated;
grant select on public.ai_model_cache to authenticated;

-- Browser-safe connection list: no ciphertext, no key version, plus the cached model count.
create view public.ai_provider_connections with (security_invoker = true) as
select
  c.id, c.workspace_id, c.user_id, c.provider_id, c.label, c.key_last4, c.status,
  c.last_verified_at, c.last_error_code, c.created_at, c.updated_at,
  m.model_count, m.fetched_at as models_fetched_at
from public.ai_provider_credentials c
left join public.ai_model_cache m on m.credential_id = c.id;
revoke all on public.ai_provider_connections from public, anon, authenticated;
grant select on public.ai_provider_connections to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Preferences and settings (owner-writable, with credential ownership enforced by RLS)
-- ---------------------------------------------------------------------------------------------
create table public.ai_user_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose in ('chat', 'clip_planning', 'social_copy', 'editor_plan')),
  credential_id uuid not null references public.ai_provider_credentials(id) on delete cascade,
  model_id text not null check (char_length(model_id) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, purpose)
);
create index ai_user_preferences_credential_idx on public.ai_user_preferences (credential_id);
create trigger ai_user_preferences_touch before update on public.ai_user_preferences
  for each row execute function public.ai_touch_updated_at();

alter table public.ai_user_preferences enable row level security;
create policy ai_prefs_select on public.ai_user_preferences for select to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy ai_prefs_insert on public.ai_user_preferences for insert to authenticated
  with check (
    user_id = (select auth.uid()) and public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.ai_provider_credentials c
      where c.id = credential_id and c.user_id = (select auth.uid())
        and c.workspace_id = ai_user_preferences.workspace_id and c.status = 'active'
    )
  );
create policy ai_prefs_update on public.ai_user_preferences for update to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id))
  with check (
    user_id = (select auth.uid()) and public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.ai_provider_credentials c
      where c.id = credential_id and c.user_id = (select auth.uid())
        and c.workspace_id = ai_user_preferences.workspace_id and c.status = 'active'
    )
  );
create policy ai_prefs_delete on public.ai_user_preferences for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
revoke all on public.ai_user_preferences from public, anon, authenticated;
grant select, delete on public.ai_user_preferences to authenticated;
grant insert (workspace_id, user_id, purpose, credential_id, model_id)
  on public.ai_user_preferences to authenticated;
grant update (credential_id, model_id) on public.ai_user_preferences to authenticated;

create table public.ai_user_settings (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Null keeps chats until the user deletes them; otherwise threads expire this many days after
  -- their last message (see purge_expired_ai_chats).
  chat_retention_days integer check (chat_retention_days is null or chat_retention_days between 1 and 3650),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create trigger ai_user_settings_touch before update on public.ai_user_settings
  for each row execute function public.ai_touch_updated_at();
alter table public.ai_user_settings enable row level security;
create policy ai_settings_select on public.ai_user_settings for select to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy ai_settings_insert on public.ai_user_settings for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy ai_settings_update on public.ai_user_settings for update to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id))
  with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
revoke all on public.ai_user_settings from public, anon, authenticated;
grant select on public.ai_user_settings to authenticated;
grant insert (workspace_id, user_id, chat_retention_days) on public.ai_user_settings to authenticated;
grant update (chat_retention_days) on public.ai_user_settings to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------------------------
create table public.ai_chat_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New chat' check (char_length(title) between 1 and 160),
  project_id text check (project_id is null or char_length(project_id) <= 80),
  clip_job_id uuid references public.clip_jobs(id) on delete set null,
  credential_id uuid references public.ai_provider_credentials(id) on delete set null,
  provider_id text check (provider_id is null or provider_id ~ '^[a-z][a-z0-9_]{1,31}$'),
  model_id text check (model_id is null or char_length(model_id) between 1 and 200),
  system_prompt text check (system_prompt is null or char_length(system_prompt) <= 4000),
  archived_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_chat_threads_owner_idx
  on public.ai_chat_threads (workspace_id, user_id, archived_at, last_message_at desc);
create index ai_chat_threads_credential_idx on public.ai_chat_threads (credential_id);
create index ai_chat_threads_clip_job_idx on public.ai_chat_threads (clip_job_id);
create trigger ai_chat_threads_touch before update on public.ai_chat_threads
  for each row execute function public.ai_touch_updated_at();

alter table public.ai_chat_threads enable row level security;
create policy ai_threads_select on public.ai_chat_threads for select to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy ai_threads_insert on public.ai_chat_threads for insert to authenticated
  with check (
    user_id = (select auth.uid()) and public.is_workspace_member(workspace_id)
    and (credential_id is null or exists (
      select 1 from public.ai_provider_credentials c
      where c.id = credential_id and c.user_id = (select auth.uid())
        and c.workspace_id = ai_chat_threads.workspace_id
    ))
    and (clip_job_id is null or exists (
      select 1 from public.clip_jobs j
      where j.id = clip_job_id and j.workspace_id = ai_chat_threads.workspace_id
    ))
  );
create policy ai_threads_update on public.ai_chat_threads for update to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id))
  with check (
    user_id = (select auth.uid()) and public.is_workspace_member(workspace_id)
    and (credential_id is null or exists (
      select 1 from public.ai_provider_credentials c
      where c.id = credential_id and c.user_id = (select auth.uid())
        and c.workspace_id = ai_chat_threads.workspace_id
    ))
    and (clip_job_id is null or exists (
      select 1 from public.clip_jobs j
      where j.id = clip_job_id and j.workspace_id = ai_chat_threads.workspace_id
    ))
  );
-- A real delete: messages cascade, nothing is retained.
create policy ai_threads_delete on public.ai_chat_threads for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
revoke all on public.ai_chat_threads from public, anon, authenticated;
grant select, delete on public.ai_chat_threads to authenticated;
grant insert (
  workspace_id, user_id, title, project_id, clip_job_id, credential_id, provider_id, model_id, system_prompt
) on public.ai_chat_threads to authenticated;
grant update (
  title, project_id, clip_job_id, credential_id, provider_id, model_id, system_prompt, archived_at
) on public.ai_chat_threads to authenticated;

create table public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_chat_threads(id) on delete cascade,
  -- Denormalised from the thread so RLS and Realtime filters need no join.
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '' check (char_length(content) <= 200000),
  status text not null default 'complete'
    check (status in ('pending', 'streaming', 'complete', 'interrupted', 'failed', 'cancelled')),
  provider_id text check (provider_id is null or provider_id ~ '^[a-z][a-z0-9_]{1,31}$'),
  model_id text check (model_id is null or char_length(model_id) between 1 and 200),
  usage_input_tokens integer check (usage_input_tokens is null or usage_input_tokens >= 0),
  usage_output_tokens integer check (usage_output_tokens is null or usage_output_tokens >= 0),
  finish_reason text check (finish_reason is null or finish_reason in ('stop', 'length', 'content_filter', 'other')),
  error_code text check (error_code is null or char_length(error_code) <= 64),
  parent_message_id uuid references public.ai_chat_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index ai_chat_messages_thread_idx on public.ai_chat_messages (thread_id, created_at);
create index ai_chat_messages_parent_idx on public.ai_chat_messages (parent_message_id);
create index ai_chat_messages_owner_idx on public.ai_chat_messages (workspace_id, user_id);
create trigger ai_chat_messages_touch before update on public.ai_chat_messages
  for each row execute function public.ai_touch_updated_at();

-- Mirrors src/domain/ai/message-state.ts. Terminal states never reopen; an interrupted reply may
-- resume streaming.
create or replace function public.ai_chat_message_status_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('streaming', 'complete', 'failed', 'cancelled'))
      or (old.status = 'streaming' and new.status in ('complete', 'interrupted', 'failed', 'cancelled'))
      or (old.status = 'interrupted' and new.status in ('streaming', 'complete', 'failed', 'cancelled'))
    ) then
      raise exception 'ai_chat_message_invalid_status_transition: % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger ai_chat_messages_status_guard before update on public.ai_chat_messages
  for each row execute function public.ai_chat_message_status_guard();

alter table public.ai_chat_messages enable row level security;
create policy ai_messages_select on public.ai_chat_messages for select to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
-- Read-only for browsers: status, usage and content are written by trusted server code only.
revoke all on public.ai_chat_messages from public, anon, authenticated;
grant select on public.ai_chat_messages to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Durable AI runs. Clip planning that rides an existing job_tasks task links it via job_task_id;
-- standalone runs (bulk social copy, scheduled generation) are leased directly from this table,
-- like connector_tasks, because job_tasks requires a clip job.
-- ---------------------------------------------------------------------------------------------
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose in ('chat', 'clip_planning', 'social_copy', 'editor_plan')),
  status text not null default 'queued'
    check (status in ('queued', 'leased', 'running', 'retry_wait', 'succeeded', 'failed', 'dead_lettered', 'cancelled')),
  credential_id uuid references public.ai_provider_credentials(id) on delete set null,
  -- Which resolution path served the run: the user's own key, the platform fallback, or the
  -- deterministic non-LLM selection. The UI says "planned with your Claude key" from this.
  credential_source text check (credential_source is null or credential_source in ('user_key', 'platform', 'deterministic')),
  provider_id text check (provider_id is null or provider_id ~ '^[a-z][a-z0-9_]{1,31}$'),
  model_id text check (model_id is null or char_length(model_id) between 1 and 200),
  clip_job_id uuid references public.clip_jobs(id) on delete cascade,
  job_task_id uuid references public.job_tasks(id) on delete set null,
  thread_id uuid references public.ai_chat_threads(id) on delete set null,
  -- References and parameters only; never keys, never raw transcripts.
  input_json jsonb not null default '{}'::jsonb check (pg_column_size(input_json) <= 65536),
  result_json jsonb check (result_json is null or pg_column_size(result_json) <= 1048576),
  error_code text check (error_code is null or char_length(error_code) <= 64),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  usage_input_tokens bigint check (usage_input_tokens is null or usage_input_tokens >= 0),
  usage_output_tokens bigint check (usage_output_tokens is null or usage_output_tokens >= 0),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  priority integer not null default 10,
  lease_owner text,
  lease_expires_at timestamptz,
  last_heartbeat_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  progress_current bigint,
  progress_total bigint,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);
create index ai_runs_owner_idx on public.ai_runs (workspace_id, user_id, created_at desc);
create index ai_runs_claim_idx on public.ai_runs (status, next_attempt_at, priority desc, created_at)
  where job_task_id is null;
create index ai_runs_credential_idx on public.ai_runs (credential_id, status);
create index ai_runs_clip_job_idx on public.ai_runs (clip_job_id);
create index ai_runs_job_task_idx on public.ai_runs (job_task_id);
create index ai_runs_thread_idx on public.ai_runs (thread_id);
create trigger ai_runs_touch before update on public.ai_runs
  for each row execute function public.ai_touch_updated_at();

alter table public.ai_runs enable row level security;
create policy ai_runs_select on public.ai_runs for select to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
revoke all on public.ai_runs from public, anon, authenticated;
-- Table-level (not column-level) so Supabase Realtime can deliver run changes. Owner-only via RLS;
-- input_json holds references and parameters, never keys or raw transcripts.
grant select on public.ai_runs to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Abuse controls and retention
-- ---------------------------------------------------------------------------------------------
-- Every key validation attempt is logged so server code can rate limit per user. Contains no key
-- material; outcome is a short classification such as ok/invalid/forbidden/rate_limited/network.
create table public.ai_credential_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider_id text not null check (provider_id ~ '^[a-z][a-z0-9_]{1,31}$'),
  outcome text not null check (char_length(outcome) <= 32),
  created_at timestamptz not null default now()
);
create index ai_credential_attempts_user_idx on public.ai_credential_attempts (user_id, created_at desc);
alter table public.ai_credential_attempts enable row level security;
revoke all on public.ai_credential_attempts from public, anon, authenticated;

create or replace function public.purge_expired_ai_chats()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_deleted integer;
begin
  with doomed as (
    delete from public.ai_chat_threads t
    using public.ai_user_settings s
    where s.workspace_id = t.workspace_id and s.user_id = t.user_id
      and s.chat_retention_days is not null
      and t.last_message_at < now() - make_interval(days => s.chat_retention_days)
    returning t.id
  )
  select count(*) into v_deleted from doomed;
  delete from public.ai_credential_attempts where created_at < now() - interval '2 days';
  return v_deleted;
end;
$$;
revoke all on function public.purge_expired_ai_chats() from public, anon, authenticated;
grant execute on function public.purge_expired_ai_chats() to service_role;

-- Realtime: the UI watches message streaming state and run progress without polling.
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['ai_chat_messages', 'ai_runs'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;

commit;
