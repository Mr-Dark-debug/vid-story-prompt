begin;

update public.processing_events
set message = case message
  when 'Protected egress retry requested. The task is queued.'
    then 'Automatic source retry requested. The task is queued.'
  when 'Trying a distinct protected YouTube egress path.'
    then 'Trying another protected source connection.'
  when 'Trying the operator-configured YouTube egress path.'
    then 'Trying the configured source connection.'
  when 'Trying the optional self-hosted source adapter.'
    then 'Trying another safe source connection.'
  else message
end
where message in (
  'Protected egress retry requested. The task is queued.',
  'Trying a distinct protected YouTube egress path.',
  'Trying the operator-configured YouTube egress path.',
  'Trying the optional self-hosted source adapter.'
);

create or replace function public.record_source_acquisition_attempt(
  p_job_task_id uuid,
  p_ordinal integer,
  p_source_tier text,
  p_strategy text,
  p_pool_member_index integer,
  p_pool_member_id text,
  p_egress_fingerprint text,
  p_idempotency_key text
) returns public.source_acquisition_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.job_tasks%rowtype;
  v_attempt public.source_acquisition_attempts%rowtype;
begin
  select * into v_task from public.job_tasks where id = p_job_task_id;
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  if p_source_tier not in ('direct','operator_proxy','warp','cobalt','local_relay','authorised_source') then
    raise exception 'invalid_source_tier' using errcode = '22023';
  end if;

  select * into v_attempt
  from public.source_acquisition_attempts
  where idempotency_key = p_idempotency_key;
  if found then
    if v_attempt.job_task_id <> p_job_task_id
      or v_attempt.ordinal <> p_ordinal
      or v_attempt.source_tier <> p_source_tier then
      raise exception 'idempotency_key_reused' using errcode = '23505';
    end if;
    return v_attempt;
  end if;

  insert into public.source_acquisition_attempts (
    clip_job_id, job_task_id, ordinal, source_tier, strategy,
    pool_member_index, pool_member_id, egress_fingerprint,
    status, idempotency_key, started_at, heartbeat_at
  ) values (
    v_task.clip_job_id, v_task.id, p_ordinal, p_source_tier, nullif(p_strategy,''),
    p_pool_member_index, nullif(left(p_pool_member_id,120),''),
    nullif(left(p_egress_fingerprint,128),''), 'running', p_idempotency_key, now(), now()
  ) returning * into v_attempt;

  insert into public.processing_events (
    clip_job_id, job_task_id, stage, severity, message, attempt,
    proxy_tier, source_tier, pool_member_index, acquisition_attempt_id
  ) values (
    v_task.clip_job_id, v_task.id, 'source_acquisition_attempt', 'info',
    case p_source_tier
      when 'warp' then 'Trying another protected source connection.'
      when 'operator_proxy' then 'Trying the configured source connection.'
      when 'cobalt' then 'Trying another safe source connection.'
      when 'local_relay' then 'Waiting for an authorised source connection.'
      else 'Trying the next authorised source connection.'
    end,
    v_task.attempt,
    case p_source_tier when 'operator_proxy' then 'operator' when 'warp' then 'warp' else null end,
    p_source_tier, p_pool_member_index, v_attempt.id
  );
  return v_attempt;
end;
$$;

commit;
