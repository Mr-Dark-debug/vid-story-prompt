-- Durable AI run lane: claiming, leasing, concurrency cap, cancellation and retry classification.
-- Runs in the isolated cluster after both BYOK migrations (see scripts/test-ai-byok-db.ps1).
begin;

insert into auth.users(id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'a@example.test'),
  ('00000000-0000-4000-8000-0000000000b2', 'b@example.test');
insert into public.workspaces(id, name, owner_id) values
  ('10000000-0000-4000-8000-0000000000a1', 'A', '00000000-0000-4000-8000-0000000000a1'),
  ('10000000-0000-4000-8000-0000000000b2', 'B', '00000000-0000-4000-8000-0000000000b2');

set local role service_role;
insert into public.ai_provider_credentials(id, workspace_id, user_id, provider_id, label, key_encrypted, key_version, key_last4) values
  ('30000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'anthropic', 'One', 'aik1.1.x.y', '1', 'aaaa'),
  ('30000000-0000-4000-8000-0000000000c2', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'openai', 'Two', 'aik1.1.x.y', '1', 'bbbb');

-- Three runs on credential 1 (oldest first), one on credential 2, one with no credential.
insert into public.ai_runs(id, workspace_id, user_id, purpose, credential_id, idempotency_key, priority, created_at) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'social_copy', '30000000-0000-4000-8000-0000000000c1', 'queue-key-0001', 10, now() - interval '5 minutes'),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'social_copy', '30000000-0000-4000-8000-0000000000c1', 'queue-key-0002', 10, now() - interval '4 minutes'),
  ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'social_copy', '30000000-0000-4000-8000-0000000000c1', 'queue-key-0003', 10, now() - interval '3 minutes'),
  ('60000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'social_copy', '30000000-0000-4000-8000-0000000000c2', 'queue-key-0004', 10, now() - interval '2 minutes'),
  ('60000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'social_copy', null, 'queue-key-0005', 99, now() - interval '1 minute');

-- Idempotency: the same key in the same workspace is rejected.
do $$ begin
  begin
    insert into public.ai_runs(workspace_id, user_id, purpose, idempotency_key)
    values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'social_copy', 'queue-key-0001');
    raise exception 'Duplicate idempotency key accepted';
  exception when unique_violation then null; end;
end $$;

-- A run riding an existing job_tasks task is never claimable from this lane.
insert into public.clip_jobs(id, workspace_id, user_id, source_type, watermark_required, export_limit_json, retention_expires_at)
values ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'local_upload', true, '{}', now() + interval '7 days');
insert into public.job_tasks(id, clip_job_id, task_type, idempotency_key)
values ('71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'generate_candidate_windows', 'task-key-0001');
insert into public.ai_runs(id, workspace_id, user_id, purpose, idempotency_key, job_task_id, clip_job_id, priority)
values ('60000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'clip_planning', 'task-run-0001', '71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 1000);

-- 1. Priority first, then age; claiming leases and counts the attempt.
do $$
declare v public.ai_runs;
begin
  select * into v from public.claim_ai_run('worker-1', 120, 2);
  if v.id <> '60000000-0000-4000-8000-000000000005' or v.status <> 'leased' or v.attempt <> 1 or v.lease_owner <> 'worker-1' then
    raise exception 'Highest priority run was not claimed first: %', v.id;
  end if;
  select * into v from public.claim_ai_run('worker-1', 120, 2);
  if v.id <> '60000000-0000-4000-8000-000000000001' then raise exception 'Oldest run was not next: %', v.id; end if;
  select * into v from public.claim_ai_run('worker-2', 120, 2);
  if v.id <> '60000000-0000-4000-8000-000000000002' then raise exception 'Second run on credential 1 should still fit the cap: %', v.id; end if;
end $$;

-- 2. Credential 1 now has two active runs, so its third run is skipped but credential 2 is not starved.
do $$
declare v public.ai_runs;
begin
  select * into v from public.claim_ai_run('worker-2', 120, 2);
  if v.id <> '60000000-0000-4000-8000-000000000004' then raise exception 'Capped credential starved another credential: %', v.id; end if;
  select * into v from public.claim_ai_run('worker-3', 120, 2);
  if v.id is not null then raise exception 'Per-credential cap exceeded: claimed %', v.id; end if;
  if (select status from public.ai_runs where id = '60000000-0000-4000-8000-0000000000f1') <> 'queued' then raise exception 'Job-task-bound run was touched'; end if;
end $$;

-- 3. Lease ownership: only the owner can start, heartbeat, complete.
do $$
begin
  if public.start_ai_run('60000000-0000-4000-8000-000000000001', 'worker-2') is not null then raise exception 'Non-owner started a run'; end if;
  if not public.start_ai_run('60000000-0000-4000-8000-000000000001', 'worker-1') then raise exception 'Owner could not start'; end if;
  if not public.heartbeat_ai_run('60000000-0000-4000-8000-000000000001', 'worker-1', 120, 1, 4) then raise exception 'Owner heartbeat failed'; end if;
  if public.heartbeat_ai_run('60000000-0000-4000-8000-000000000001', 'worker-2', 120) is not null then raise exception 'Non-owner heartbeat accepted'; end if;
  if (select progress_current from public.ai_runs where id = '60000000-0000-4000-8000-000000000001') <> 1 then raise exception 'Progress not recorded'; end if;
  if public.complete_ai_run('60000000-0000-4000-8000-000000000001', 'worker-2', '{}') is not null then raise exception 'Non-owner completed a run'; end if;
  if not public.complete_ai_run('60000000-0000-4000-8000-000000000001', 'worker-1', '{"candidates":3}', 'anthropic', 'claude-opus-5', 'user_key', 120, 340) then raise exception 'Owner could not complete'; end if;
  if not exists (select 1 from public.ai_runs where id = '60000000-0000-4000-8000-000000000001' and status = 'succeeded' and result_json->>'candidates' = '3' and usage_input_tokens = 120 and usage_output_tokens = 340 and credential_source = 'user_key' and lease_owner is null) then
    raise exception 'Completion not recorded';
  end if;
  -- Completing frees the credential's concurrency slot.
  if (select id from public.claim_ai_run('worker-3', 120, 2)) <> '60000000-0000-4000-8000-000000000003' then raise exception 'Slot not released after completion'; end if;
end $$;

-- 4. Cancellation: heartbeat tells the worker to stop; a late completion cannot resurrect the run.
do $$
begin
  if public.cancel_ai_run('60000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000b2') is not null then raise exception 'Another user cancelled a run'; end if;
  perform public.start_ai_run('60000000-0000-4000-8000-000000000002', 'worker-2');
  if not public.cancel_ai_run('60000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a1') then raise exception 'Owner could not cancel'; end if;
  if public.heartbeat_ai_run('60000000-0000-4000-8000-000000000002', 'worker-2', 120) is not null then raise exception 'Heartbeat continued after cancellation'; end if;
  if public.complete_ai_run('60000000-0000-4000-8000-000000000002', 'worker-2', '{}') is not null then raise exception 'Cancelled run was completed'; end if;
  if public.fail_ai_run('60000000-0000-4000-8000-000000000002', 'worker-2', 'bad_request', 'x', false) <> 'cancelled' then raise exception 'Failure overrode cancellation'; end if;
  if (select status from public.ai_runs where id = '60000000-0000-4000-8000-000000000002') <> 'cancelled' then raise exception 'Run not cancelled'; end if;
  if public.cancel_ai_run('60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1') is not null then raise exception 'A finished run was cancelled'; end if;
end $$;

-- 5. Retry classification.
do $$
declare v text;
begin
  -- worker-2 holds run 4 (attempt 1 of 5): a transient failure retries later.
  perform public.start_ai_run('60000000-0000-4000-8000-000000000004', 'worker-2');
  v := public.fail_ai_run('60000000-0000-4000-8000-000000000004', 'worker-2', 'rate_limited', 'slow down', true, now() + interval '90 seconds');
  if v <> 'retry_wait' then raise exception 'Transient failure was % not retry_wait', v; end if;
  if not exists (select 1 from public.ai_runs where id = '60000000-0000-4000-8000-000000000004' and next_attempt_at > now() + interval '60 seconds' and lease_owner is null and error_code = 'rate_limited') then
    raise exception 'Backoff not recorded';
  end if;
  if exists (select 1 from public.claim_ai_run('worker-2', 120, 2) where id = '60000000-0000-4000-8000-000000000004') then raise exception 'Run claimed before its backoff elapsed'; end if;
  -- Wrong worker cannot fail someone else's lease.
  if public.fail_ai_run('60000000-0000-4000-8000-000000000003', 'worker-9', 'x', 'y', false) <> 'lease_lost' then raise exception 'Wrong worker could fail a run'; end if;
  -- Non-retryable (for example a rejected key) fails immediately.
  v := public.fail_ai_run('60000000-0000-4000-8000-000000000003', 'worker-3', 'invalid_key', 'reconnect', false);
  if v <> 'failed' then raise exception 'Non-retryable failure was %', v; end if;
  -- Attempts exhausted becomes a dead letter.
  update public.ai_runs set status = 'leased', lease_owner = 'worker-5', lease_expires_at = now() + interval '1 minute', attempt = max_attempts where id = '60000000-0000-4000-8000-000000000004';
  v := public.fail_ai_run('60000000-0000-4000-8000-000000000004', 'worker-5', 'provider_unavailable', 'down', true);
  if v <> 'dead_lettered' then raise exception 'Exhausted run was %', v; end if;
end $$;

-- 6. A crashed worker's expired lease is reclaimed, and dead-lettered once attempts run out.
do $$
declare v public.ai_runs;
begin
  insert into public.ai_runs(id, workspace_id, user_id, purpose, idempotency_key, status, lease_owner, lease_expires_at, attempt, max_attempts)
  values ('60000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'social_copy', 'crash-key-0001', 'running', 'dead-worker', now() - interval '1 minute', 1, 3),
         ('60000000-0000-4000-8000-0000000000e2', '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'social_copy', 'crash-key-0002', 'running', 'dead-worker', now() - interval '1 minute', 3, 3);
  select * into v from public.claim_ai_run('worker-7', 120, 2);
  if v.id <> '60000000-0000-4000-8000-0000000000e1' or v.attempt <> 2 or v.lease_owner <> 'worker-7' then raise exception 'Expired lease was not reclaimed: %', v.id; end if;
  if (select status from public.ai_runs where id = '60000000-0000-4000-8000-0000000000e2') <> 'dead_lettered' then raise exception 'Exhausted crashed run was not dead-lettered'; end if;
end $$;
reset role;

-- 7. Only the service role may drive the queue.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
do $$ begin
  begin perform public.claim_ai_run('hax', 120, 2); raise exception 'Browser claimed a run'; exception when insufficient_privilege then null; end;
  begin perform public.complete_ai_run('60000000-0000-4000-8000-000000000001', 'x', '{}'); raise exception 'Browser completed a run'; exception when insufficient_privilege then null; end;
  begin perform public.cancel_ai_run('60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1'); raise exception 'Browser called cancel RPC directly'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.claim_ai_run('hax', 120, 2); raise exception 'Anonymous claimed a run'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 8. Planning runs record provenance but only trusted code writes it.
set local role service_role;
insert into public.planning_runs(id, clip_job_id, provider, model, prompt_version, schema_version, status, credential_source, credential_id, fallback_reason)
values ('80000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'anthropic', 'claude-opus-5', 'v', 's', 'succeeded', 'user_key', '30000000-0000-4000-8000-0000000000c1', null);
do $$ begin
  begin
    insert into public.planning_runs(clip_job_id, provider, model, prompt_version, schema_version, status, credential_source)
    values ('70000000-0000-4000-8000-000000000001', 'x', 'y', 'v', 's', 'succeeded', 'bogus');
    raise exception 'Unknown credential source accepted';
  exception when check_violation then null; end;
end $$;
delete from public.ai_provider_credentials where id = '30000000-0000-4000-8000-0000000000c1';
do $$ begin
  if (select credential_id from public.planning_runs where id = '80000000-0000-4000-8000-000000000001') is not null then raise exception 'Planning run still references a deleted credential'; end if;
  if (select credential_source from public.planning_runs where id = '80000000-0000-4000-8000-000000000001') <> 'user_key' then raise exception 'Provenance lost when the key was deleted'; end if;
end $$;
reset role;

rollback;
