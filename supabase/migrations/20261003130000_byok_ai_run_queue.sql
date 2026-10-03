-- Durable lane for unattended AI work (bulk social copy, regenerate-many, scheduled generation).
--
-- job_tasks requires a clip job, so standalone runs are leased directly from public.ai_runs, the
-- same way connector_tasks is leased for imports: idempotent (unique workspace/idempotency key),
-- leased, heartbeat-driven, cancellation-aware and retry-classified. A run that rides an existing
-- job_tasks task (clip planning) has job_task_id set and is never claimable here.
begin;

-- Provenance for clip planning, so the UI can say "planned with your Claude key".
alter table public.planning_runs
  add column if not exists credential_source text
    check (credential_source is null or credential_source in ('user_key', 'platform', 'deterministic')),
  add column if not exists credential_id uuid references public.ai_provider_credentials(id) on delete set null,
  add column if not exists fallback_reason text
    check (fallback_reason is null or char_length(fallback_reason) <= 64);
create index if not exists planning_runs_credential_idx on public.planning_runs (credential_id);

-- Claims the next runnable standalone run, enforcing a per-credential concurrency cap so one user's
-- key is not hammered. Expired leases are reclaimed; exhausted ones are dead-lettered.
create or replace function public.claim_ai_run(
  p_worker_id text,
  p_lease_seconds integer default 120,
  p_credential_limit integer default 2
)
returns setof public.ai_runs
language plpgsql security definer set search_path = '' as $$
declare
  v_run public.ai_runs%rowtype;
  v_active integer;
begin
  -- Runs whose worker died on their final attempt are settled before anything is claimed.
  update public.ai_runs
    set status = 'dead_lettered', error_code = coalesce(error_code, 'lease_expired'),
        lease_owner = null, lease_expires_at = null, completed_at = now()
    where job_task_id is null and status in ('leased', 'running')
      and lease_expires_at < now() and attempt >= max_attempts;

  for v_run in
    select r.* from public.ai_runs r
    where r.job_task_id is null
      and (
        (r.status in ('queued', 'retry_wait') and r.next_attempt_at <= now())
        or (r.status in ('leased', 'running') and r.lease_expires_at < now())
      )
    order by r.priority desc, r.created_at
    for update skip locked
    limit 25
  loop
    if v_run.credential_id is not null then
      -- Serialise the count-and-claim per credential so concurrent workers cannot both slip in.
      perform pg_advisory_xact_lock(hashtextextended(v_run.credential_id::text, 0));
      select count(*) into v_active from public.ai_runs o
        where o.credential_id = v_run.credential_id and o.id <> v_run.id
          and o.status in ('leased', 'running') and o.lease_expires_at >= now();
      if v_active >= greatest(1, p_credential_limit) then
        continue;
      end if;
    end if;

    update public.ai_runs
      set status = 'leased', lease_owner = p_worker_id,
          lease_expires_at = now() + make_interval(secs => greatest(30, p_lease_seconds)),
          last_heartbeat_at = now(), attempt = attempt + 1
      where id = v_run.id
      returning * into v_run;
    return next v_run;
    return;
  end loop;
end;
$$;

create or replace function public.start_ai_run(p_run_id uuid, p_worker_id text)
returns boolean language sql security definer set search_path = '' as $$
  update public.ai_runs
    set status = 'running', started_at = coalesce(started_at, now())
  where id = p_run_id and lease_owner = p_worker_id and lease_expires_at > now()
    and status in ('leased', 'running')
  returning true;
$$;

-- Returns false when the lease was lost or the run was cancelled, telling the worker to stop.
create or replace function public.heartbeat_ai_run(
  p_run_id uuid, p_worker_id text, p_lease_seconds integer,
  p_current bigint default null, p_total bigint default null
)
returns boolean language sql security definer set search_path = '' as $$
  update public.ai_runs
    set lease_expires_at = now() + make_interval(secs => greatest(30, p_lease_seconds)),
        last_heartbeat_at = now(),
        progress_current = coalesce(p_current, progress_current),
        progress_total = coalesce(p_total, progress_total)
  where id = p_run_id and lease_owner = p_worker_id and status = 'running'
  returning true;
$$;

create or replace function public.complete_ai_run(
  p_run_id uuid, p_worker_id text, p_result jsonb,
  p_provider_id text default null, p_model_id text default null,
  p_credential_source text default null,
  p_input_tokens bigint default null, p_output_tokens bigint default null
)
returns boolean language sql security definer set search_path = '' as $$
  update public.ai_runs
    set status = 'succeeded', result_json = p_result,
        provider_id = coalesce(p_provider_id, provider_id),
        model_id = coalesce(p_model_id, model_id),
        credential_source = coalesce(p_credential_source, credential_source),
        usage_input_tokens = p_input_tokens, usage_output_tokens = p_output_tokens,
        error_code = null, error_message = null,
        lease_owner = null, lease_expires_at = null, completed_at = now()
  where id = p_run_id and lease_owner = p_worker_id and status in ('leased', 'running')
  returning true;
$$;

create or replace function public.fail_ai_run(
  p_run_id uuid, p_worker_id text, p_error_code text, p_error_message text,
  p_retryable boolean, p_next_attempt_at timestamptz default null
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_run public.ai_runs%rowtype;
  v_status text;
begin
  select * into v_run from public.ai_runs where id = p_run_id for update;
  if not found or v_run.lease_owner is distinct from p_worker_id then return 'lease_lost'; end if;
  -- A user cancellation always wins over whatever the worker was reporting.
  if v_run.status = 'cancelled' then
    update public.ai_runs set lease_owner = null, lease_expires_at = null where id = p_run_id;
    return 'cancelled';
  end if;
  v_status := case
    when p_error_code = 'cancelled' then 'cancelled'
    when p_retryable and v_run.attempt < v_run.max_attempts then 'retry_wait'
    when p_retryable then 'dead_lettered'
    else 'failed'
  end;
  update public.ai_runs
    set status = v_status, error_code = left(p_error_code, 64), error_message = left(p_error_message, 500),
        next_attempt_at = case when v_status = 'retry_wait'
          then coalesce(p_next_attempt_at, now() + interval '1 minute') else next_attempt_at end,
        lease_owner = null, lease_expires_at = null,
        completed_at = case when v_status in ('failed', 'dead_lettered', 'cancelled') then now() else null end
  where id = p_run_id;
  return v_status;
end;
$$;

-- User-initiated cancel (called by trusted server code after authorising the user).
create or replace function public.cancel_ai_run(p_run_id uuid, p_user_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  update public.ai_runs
    set status = 'cancelled', completed_at = now(), error_code = 'cancelled',
        lease_owner = case when status in ('leased', 'running') then lease_owner else null end
  where id = p_run_id and user_id = p_user_id
    and status in ('queued', 'retry_wait', 'leased', 'running')
  returning true;
$$;

revoke all on function
  public.claim_ai_run(text, integer, integer),
  public.start_ai_run(uuid, text),
  public.heartbeat_ai_run(uuid, text, integer, bigint, bigint),
  public.complete_ai_run(uuid, text, jsonb, text, text, text, bigint, bigint),
  public.fail_ai_run(uuid, text, text, text, boolean, timestamptz),
  public.cancel_ai_run(uuid, uuid)
from public, anon, authenticated;
grant execute on function
  public.claim_ai_run(text, integer, integer),
  public.start_ai_run(uuid, text),
  public.heartbeat_ai_run(uuid, text, integer, bigint, bigint),
  public.complete_ai_run(uuid, text, jsonb, text, text, text, bigint, bigint),
  public.fail_ai_run(uuid, text, text, text, boolean, timestamptz),
  public.cancel_ai_run(uuid, uuid)
to service_role;

commit;
