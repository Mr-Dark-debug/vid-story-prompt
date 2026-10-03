-- BYOK AI layer: workspace isolation, ciphertext secrecy and write boundaries.
-- Runs against an isolated PostgreSQL cluster (see scripts/test-ai-byok-db.ps1) that loads the real
-- foundation and BYOK migrations with Supabase's default role grants emulated. It is a contract
-- test of grants, RLS and triggers, not a test of managed Supabase Realtime.
begin;

insert into auth.users(id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'a@example.test'),
  ('00000000-0000-4000-8000-0000000000b2', 'b@example.test');
insert into public.workspaces(id, name, owner_id) values
  ('10000000-0000-4000-8000-0000000000a1', 'A', '00000000-0000-4000-8000-0000000000a1'),
  ('10000000-0000-4000-8000-0000000000b2', 'B', '00000000-0000-4000-8000-0000000000b2');

-- Trusted server writes (service role), as the app performs them.
set local role service_role;
insert into public.ai_provider_credentials(id, workspace_id, user_id, provider_id, label, key_encrypted, key_version, key_last4) values
  ('30000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'anthropic', 'Personal', 'aik1.1.SECRETIV.SECRETCIPHERTEXT', '1', 'wxyz'),
  ('30000000-0000-4000-8000-0000000000b2', '10000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b2', 'openai', 'Team', 'aik1.1.SECRETIV.OTHERCIPHERTEXT', '1', 'ab12');
insert into public.ai_model_cache(credential_id, workspace_id, user_id, models_json, model_count) values
  ('30000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', '[{"modelId":"claude-opus-5"}]', 1);
insert into public.ai_chat_threads(id, workspace_id, user_id, title, credential_id, provider_id, model_id) values
  ('40000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'A thread', '30000000-0000-4000-8000-0000000000a1', 'anthropic', 'claude-opus-5'),
  ('40000000-0000-4000-8000-0000000000b2', '10000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b2', 'B thread', '30000000-0000-4000-8000-0000000000b2', 'openai', 'gpt-4o');
insert into public.ai_chat_messages(id, thread_id, workspace_id, user_id, role, content, status) values
  ('50000000-0000-4000-8000-0000000000a1', '40000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'user', 'secret prompt A', 'complete'),
  ('50000000-0000-4000-8000-0000000000a2', '40000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'assistant', 'partial', 'streaming'),
  ('50000000-0000-4000-8000-0000000000b1', '40000000-0000-4000-8000-0000000000b2', '10000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b2', 'user', 'secret prompt B', 'complete');
insert into public.ai_runs(id, workspace_id, user_id, purpose, credential_id, credential_source, idempotency_key, input_json) values
  ('60000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'social_copy', '30000000-0000-4000-8000-0000000000a1', 'user_key', 'run-key-a-0001', '{"prompt":"private"}'),
  ('60000000-0000-4000-8000-0000000000b2', '10000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b2', 'social_copy', '30000000-0000-4000-8000-0000000000b2', 'user_key', 'run-key-b-0001', '{}');
insert into public.ai_credential_attempts(user_id, workspace_id, provider_id, outcome) values
  ('00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', 'anthropic', 'ok');
reset role;

-- 1. The service role can read ciphertext; nobody else can.
set local role service_role;
do $$ begin
  if (select key_encrypted from public.ai_provider_credentials where id = '30000000-0000-4000-8000-0000000000a1') is distinct from 'aik1.1.SECRETIV.SECRETCIPHERTEXT' then
    raise exception 'Worker/server lost access to ciphertext';
  end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
do $$
declare v_count integer;
begin
  -- Ciphertext columns are not readable, directly or via select *.
  begin
    perform key_encrypted from public.ai_provider_credentials;
    raise exception 'Browser role read key_encrypted';
  exception when insufficient_privilege then null; end;
  begin
    perform key_version from public.ai_provider_credentials;
    raise exception 'Browser role read key_version';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.ai_provider_credentials;
    raise exception 'Browser role ran select * on the credentials table';
  exception when insufficient_privilege then null; end;

  -- The token-free view works and exposes no secret-bearing column.
  select count(*) into v_count from public.ai_provider_connections;
  if v_count <> 1 then raise exception 'Owner should see exactly their own connection, saw %', v_count; end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_provider_connections'
      and column_name in ('key_encrypted', 'key_version')
  ) then raise exception 'Connection view exposes key material'; end if;
  if (select model_count from public.ai_provider_connections) <> 1 then raise exception 'Model count missing from view'; end if;
  if (select key_last4 from public.ai_provider_connections) <> 'wxyz' then raise exception 'last4 missing'; end if;
end $$;

-- 2. Workspace isolation: user A sees none of B's data.
do $$ begin
  if (select count(*) from public.ai_chat_threads) <> 1 or exists (select 1 from public.ai_chat_threads where title = 'B thread') then raise exception 'Thread isolation failed'; end if;
  if (select count(*) from public.ai_chat_messages) <> 2 or exists (select 1 from public.ai_chat_messages where content = 'secret prompt B') then raise exception 'Message isolation failed'; end if;
  if (select count(*) from public.ai_runs) <> 1 then raise exception 'Run isolation failed'; end if;
  if (select count(*) from public.ai_model_cache) <> 1 then raise exception 'Cache isolation failed'; end if;
end $$;

-- run input_json (may reference prompts) is not exposed to the browser.
do $$ begin
  begin
    perform input_json from public.ai_runs;
    raise exception 'Browser role read ai_runs.input_json';
  exception when insufficient_privilege then null; end;
  if (select usage_output_tokens from public.ai_runs limit 1) is not null then raise exception 'unexpected usage'; end if;
end $$;

-- 3. Browser writes to protected tables are refused.
do $$
declare v_rows integer;
begin
  begin
    insert into public.ai_provider_credentials(workspace_id, user_id, provider_id, label, key_encrypted, key_version, key_last4)
    values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'openai', 'Evil', 'x', '1', 'abcd');
    raise exception 'Browser inserted a credential';
  exception when insufficient_privilege then null; end;
  begin
    update public.ai_provider_credentials set status = 'active';
    raise exception 'Browser updated a credential';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.ai_provider_credentials;
    raise exception 'Browser deleted a credential';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ai_chat_messages(thread_id, workspace_id, user_id, role, content)
    values ('40000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'assistant', 'forged');
    raise exception 'Browser inserted a message';
  exception when insufficient_privilege then null; end;
  -- Status, usage and content are each refused on their own: either no privilege, or RLS hides
  -- every row so nothing changes.
  begin
    update public.ai_chat_messages set status = 'complete';
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then raise exception 'Browser updated message status'; end if;
  exception when insufficient_privilege then null; end;
  begin
    update public.ai_chat_messages set usage_output_tokens = 1;
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then raise exception 'Browser updated message usage'; end if;
  exception when insufficient_privilege then null; end;
  begin
    update public.ai_chat_messages set content = 'edited';
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then raise exception 'Browser edited message content'; end if;
  exception when insufficient_privilege then null; end;
  begin
    delete from public.ai_chat_messages;
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then raise exception 'Browser deleted messages directly'; end if;
  exception when insufficient_privilege then null; end;
  begin
    update public.ai_runs set status = 'succeeded';
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then raise exception 'Browser updated a run'; end if;
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ai_runs(workspace_id, user_id, purpose, idempotency_key)
    values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'chat', 'forged-run-0001');
    raise exception 'Browser inserted a run';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.ai_credential_attempts;
    raise exception 'Browser read the attempts log';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ai_model_cache(credential_id, workspace_id, user_id) values ('30000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1');
    raise exception 'Browser wrote the model cache';
  exception when insufficient_privilege then null; end;
end $$;

-- 4. Threads: owner CRUD within bounds.
do $$
declare v_rows integer; v_thread uuid;
begin
  insert into public.ai_chat_threads(workspace_id, user_id, title, credential_id, provider_id, model_id)
  values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'Mine', '30000000-0000-4000-8000-0000000000a1', 'anthropic', 'claude-opus-5')
  returning id into v_thread;

  -- Cannot point a thread at someone else's key, forge ownership, or use another workspace.
  begin
    insert into public.ai_chat_threads(workspace_id, user_id, title, credential_id)
    values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'Steal', '30000000-0000-4000-8000-0000000000b2');
    raise exception 'Thread accepted another user''s credential';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ai_chat_threads(workspace_id, user_id, title)
    values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2', 'Forged owner');
    raise exception 'Thread accepted a forged owner';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ai_chat_threads(workspace_id, user_id, title)
    values ('10000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', 'Foreign workspace');
    raise exception 'Thread accepted a workspace the user does not belong to';
  exception when insufficient_privilege then null; end;

  update public.ai_chat_threads set title = 'Renamed', archived_at = now() where id = v_thread;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Owner could not rename/archive a thread'; end if;
  begin
    update public.ai_chat_threads set last_message_at = now() where id = v_thread;
    raise exception 'Browser changed server-managed last_message_at';
  exception when insufficient_privilege then null; end;
  begin
    update public.ai_chat_threads set credential_id = '30000000-0000-4000-8000-0000000000b2' where id = v_thread;
    raise exception 'Thread switched to another user''s credential';
  exception when insufficient_privilege then null; end;

  update public.ai_chat_threads set title = 'Hacked' where id = '40000000-0000-4000-8000-0000000000b2';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'Updated another workspace''s thread'; end if;
  delete from public.ai_chat_threads where id = '40000000-0000-4000-8000-0000000000b2';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'Deleted another workspace''s thread'; end if;
end $$;

-- 5. Preferences require the user's own active credential.
do $$
begin
  insert into public.ai_user_preferences(workspace_id, user_id, purpose, credential_id, model_id)
  values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'chat', '30000000-0000-4000-8000-0000000000a1', 'claude-opus-5');
  begin
    insert into public.ai_user_preferences(workspace_id, user_id, purpose, credential_id, model_id)
    values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'clip_planning', '30000000-0000-4000-8000-0000000000b2', 'gpt-4o');
    raise exception 'Preference accepted another user''s credential';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ai_user_preferences(workspace_id, user_id, purpose, credential_id, model_id)
    values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'chat', '30000000-0000-4000-8000-0000000000a1', 'dup');
    raise exception 'Duplicate purpose preference accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.ai_user_preferences(workspace_id, user_id, purpose, credential_id, model_id)
    values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'bogus', '30000000-0000-4000-8000-0000000000a1', 'x');
    raise exception 'Unknown purpose accepted';
  exception when check_violation then null; end;
end $$;
do $$
declare v_rows integer;
begin
  insert into public.ai_user_settings(workspace_id, user_id, chat_retention_days) values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 30);
  update public.ai_user_settings set chat_retention_days = 7;
  begin
    update public.ai_user_settings set chat_retention_days = 0;
    raise exception 'Retention of zero days accepted';
  exception when check_violation then null; end;
end $$;
reset role;

-- 6. User B cannot see A's rows and cannot adopt A's credential.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true);
do $$ begin
  if (select count(*) from public.ai_provider_connections) <> 1 or exists (select 1 from public.ai_provider_connections where provider_id = 'anthropic') then raise exception 'B sees A''s connection'; end if;
  if exists (select 1 from public.ai_chat_messages where content like '%A%') then raise exception 'B sees A''s messages'; end if;
  if (select count(*) from public.ai_user_preferences) <> 0 then raise exception 'B sees A''s preferences'; end if;
  begin
    insert into public.ai_user_preferences(workspace_id, user_id, purpose, credential_id, model_id)
    values ('10000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b2', 'chat', '30000000-0000-4000-8000-0000000000a1', 'claude-opus-5');
    raise exception 'B adopted A''s credential';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 7. Anonymous visitors see nothing at all.
set local role anon;
do $$
declare t text;
begin
  foreach t in array array['ai_provider_credentials', 'ai_provider_connections', 'ai_model_cache', 'ai_user_preferences', 'ai_user_settings', 'ai_chat_threads', 'ai_chat_messages', 'ai_runs', 'ai_credential_attempts'] loop
    begin
      execute format('select 1 from public.%I limit 1', t);
      raise exception 'anon could read %', t;
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
reset role;

-- 8. Trusted-side invariants.
set local role service_role;
do $$
begin
  -- An active credential must carry ciphertext; a revoked one must be wipeable.
  begin
    insert into public.ai_provider_credentials(workspace_id, user_id, provider_id, label, key_last4, status)
    values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'google', 'No key', 'abcd', 'active');
    raise exception 'Active credential without ciphertext accepted';
  exception when check_violation then null; end;
  update public.ai_provider_credentials set status = 'revoked', key_encrypted = null, key_version = null where id = '30000000-0000-4000-8000-0000000000a1';
  begin
    insert into public.ai_provider_credentials(workspace_id, user_id, provider_id, label, key_encrypted, key_version, key_last4)
    values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'anthropic', 'Personal', 'x', '1', 'abcd');
    raise exception 'Duplicate label accepted';
  exception when unique_violation then null; end;

  -- Message status machine: terminal states never reopen.
  update public.ai_chat_messages set status = 'complete', usage_input_tokens = 3, usage_output_tokens = 5, completed_at = now() where id = '50000000-0000-4000-8000-0000000000a2';
  begin
    update public.ai_chat_messages set status = 'streaming' where id = '50000000-0000-4000-8000-0000000000a2';
    raise exception 'Completed message reopened';
  exception when check_violation then null; end;
  begin
    update public.ai_chat_messages set status = 'bogus' where id = '50000000-0000-4000-8000-0000000000a1';
    raise exception 'Unknown message status accepted';
  exception when check_violation then null; end;
  begin
    insert into public.ai_chat_messages(thread_id, workspace_id, user_id, role, content, usage_input_tokens)
    values ('40000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'user', 'x', -1);
    raise exception 'Negative usage accepted';
  exception when check_violation then null; end;
end $$;
insert into public.ai_chat_messages(id, thread_id, workspace_id, user_id, role, status) values
  ('50000000-0000-4000-8000-0000000000a3', '40000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'assistant', 'pending');
do $$ begin
  update public.ai_chat_messages set status = 'streaming' where id = '50000000-0000-4000-8000-0000000000a3';
  update public.ai_chat_messages set status = 'interrupted' where id = '50000000-0000-4000-8000-0000000000a3';
  update public.ai_chat_messages set status = 'streaming' where id = '50000000-0000-4000-8000-0000000000a3';
  update public.ai_chat_messages set status = 'failed' where id = '50000000-0000-4000-8000-0000000000a3';
end $$;

-- Deleting a thread really deletes its messages.
delete from public.ai_chat_threads where id = '40000000-0000-4000-8000-0000000000a1';
do $$ begin
  if exists (select 1 from public.ai_chat_messages where thread_id = '40000000-0000-4000-8000-0000000000a1') then raise exception 'Thread delete left messages behind'; end if;
  if exists (select 1 from public.ai_chat_messages where content = 'secret prompt A') then raise exception 'Prompt text survived thread delete'; end if;
end $$;

-- Deleting a credential removes its cache and preferences and detaches runs; no ciphertext remains.
delete from public.ai_provider_credentials where id = '30000000-0000-4000-8000-0000000000a1';
do $$ begin
  if exists (select 1 from public.ai_model_cache where credential_id = '30000000-0000-4000-8000-0000000000a1') then raise exception 'Cache survived credential delete'; end if;
  if exists (select 1 from public.ai_user_preferences where credential_id = '30000000-0000-4000-8000-0000000000a1') then raise exception 'Preference survived credential delete'; end if;
  if (select credential_id from public.ai_runs where id = '60000000-0000-4000-8000-0000000000a1') is not null then raise exception 'Run still references deleted credential'; end if;
end $$;
reset role;

-- 9. Retention purge is service-only and honours the user's setting.
set local role authenticated;
do $$ begin
  begin
    perform public.purge_expired_ai_chats();
    raise exception 'Browser executed the purge';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
insert into public.ai_chat_threads(id, workspace_id, user_id, title, last_message_at) values
  ('40000000-0000-4000-8000-0000000000c3', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'Old', now() - interval '40 days'),
  ('40000000-0000-4000-8000-0000000000c4', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'Fresh', now() - interval '2 days'),
  ('40000000-0000-4000-8000-0000000000c5', '10000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b2', 'Old but no policy', now() - interval '400 days');
update public.ai_user_settings set chat_retention_days = 30;
do $$
declare v_deleted integer;
begin
  v_deleted := public.purge_expired_ai_chats();
  if v_deleted <> 1 then raise exception 'Expected one expired thread, purged %', v_deleted; end if;
  if exists (select 1 from public.ai_chat_threads where id = '40000000-0000-4000-8000-0000000000c3') then raise exception 'Expired thread kept'; end if;
  if not exists (select 1 from public.ai_chat_threads where id = '40000000-0000-4000-8000-0000000000c4') then raise exception 'Fresh thread purged'; end if;
  if not exists (select 1 from public.ai_chat_threads where id = '40000000-0000-4000-8000-0000000000c5') then raise exception 'Thread without a retention setting purged'; end if;
end $$;
reset role;

rollback;
