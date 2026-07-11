begin;

do $$
begin
  perform pgmq.create('clip_tasks');
exception when duplicate_table then null;
end $$;

create or replace function public.enqueue_direct_source_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_task_id uuid := gen_random_uuid();
begin
  if new.source_type = 'direct_owned_media_url' and new.source_asset_id is null then
    insert into public.job_tasks (id,clip_job_id,task_type,status,priority,input_json,idempotency_key,next_attempt_at)
    values (v_task_id,new.id,'download_direct_source','queued',new.priority,jsonb_build_object('url',new.source_url),new.id::text || ':download-direct',now());
    insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload_json)
    values ('clip_job',new.id,'task.queued',jsonb_build_object('jobId',new.id,'taskId',v_task_id,'taskType','download_direct_source'));
  end if;
  return new;
end;
$$;

create trigger clip_job_direct_source_task after insert on public.clip_jobs
for each row execute procedure public.enqueue_direct_source_task();

create or replace function public.dispatch_clip_outbox(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_event public.outbox_events%rowtype; v_count integer := 0;
begin
  for v_event in
    select * from public.outbox_events where status = 'pending' and next_attempt_at <= now()
    order by created_at for update skip locked limit greatest(1,least(p_limit,500))
  loop
    perform pgmq.send('clip_tasks', v_event.payload_json);
    update public.outbox_events set status = 'processed', attempt = attempt + 1, processed_at = now() where id = v_event.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.claim_clip_task(p_worker_id text, p_lease_seconds integer default 120)
returns setof public.job_tasks language plpgsql security definer set search_path = '' as $$
declare v_task public.job_tasks%rowtype; v_message record;
begin
  perform public.dispatch_clip_outbox(50);
  select * into v_message from pgmq.read('clip_tasks', greatest(30,p_lease_seconds), 1) limit 1;
  if found then perform pgmq.delete('clip_tasks', v_message.msg_id); end if;
  select * into v_task from public.job_tasks
  where (
    status in ('queued','retry_wait') and coalesce(next_attempt_at,now()) <= now()
  ) or (
    status in ('leased','running') and lease_expires_at < now()
  )
  order by priority desc, created_at for update skip locked limit 1;
  if not found then return; end if;
  update public.job_tasks set status = 'leased', lease_owner = p_worker_id,
    lease_expires_at = now() + make_interval(secs => greatest(30,p_lease_seconds)), heartbeat_at = now(),
    attempt = attempt + 1, started_at = coalesce(started_at,now())
  where id = v_task.id returning * into v_task;
  return next v_task;
end;
$$;

create or replace function public.start_clip_task(p_task_id uuid, p_worker_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.job_tasks set status = 'running', heartbeat_at = now()
  where id = p_task_id and lease_owner = p_worker_id and status = 'leased';
  return found;
end;
$$;

create or replace function public.heartbeat_clip_task(p_task_id uuid, p_worker_id text, p_lease_seconds integer, p_current bigint default null, p_total bigint default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.job_tasks set heartbeat_at = now(), lease_expires_at = now() + make_interval(secs => greatest(30,p_lease_seconds)),
    progress_current = coalesce(p_current,progress_current), progress_total = coalesce(p_total,progress_total)
  where id = p_task_id and lease_owner = p_worker_id and status in ('leased','running');
  return found;
end;
$$;

create or replace function public.complete_clip_task(
  p_task_id uuid, p_worker_id text, p_output jsonb default '{}'::jsonb,
  p_children jsonb default '[]'::jsonb, p_job_status text default null,
  p_message text default 'Task completed'
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_task public.job_tasks%rowtype; v_child jsonb; v_child_id uuid;
begin
  select * into v_task from public.job_tasks where id = p_task_id and lease_owner = p_worker_id for update;
  if not found then return false; end if;
  update public.job_tasks set status = 'succeeded', output_json = coalesce(p_output,'{}'::jsonb), completed_at = now(),
    lease_owner = null, lease_expires_at = null, heartbeat_at = now(), error_code = null, error_message = null where id = p_task_id;
  for v_child in select * from jsonb_array_elements(coalesce(p_children,'[]'::jsonb)) loop
    v_child_id := gen_random_uuid();
    insert into public.job_tasks (id,clip_job_id,task_type,status,priority,dependency_group,input_json,max_attempts,idempotency_key,next_attempt_at)
    values (v_child_id,v_task.clip_job_id,v_child->>'taskType','queued',coalesce((v_child->>'priority')::integer,v_task.priority),v_child->>'dependencyGroup',coalesce(v_child->'input','{}'::jsonb),coalesce((v_child->>'maxAttempts')::integer,5),coalesce(v_child->>'idempotencyKey',v_task.clip_job_id::text || ':' || (v_child->>'taskType') || ':' || v_child_id::text),now())
    on conflict (idempotency_key) do nothing;
    insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload_json)
    values ('clip_job',v_task.clip_job_id,'task.queued',jsonb_build_object('jobId',v_task.clip_job_id,'taskId',v_child_id,'taskType',v_child->>'taskType'));
  end loop;
  if p_job_status is not null then update public.clip_jobs set status = p_job_status, updated_at = now(), started_at = coalesce(started_at,now()) where id = v_task.clip_job_id; end if;
  insert into public.processing_events (clip_job_id,job_task_id,stage,severity,message,progress_current,progress_total,attempt)
  values (v_task.clip_job_id,v_task.id,v_task.task_type,'info',p_message,v_task.progress_total,v_task.progress_total,v_task.attempt);
  return true;
end;
$$;

create or replace function public.fail_clip_task(
  p_task_id uuid, p_worker_id text, p_error_code text, p_error_message text,
  p_retryable boolean, p_next_attempt_at timestamptz default null
) returns text language plpgsql security definer set search_path = '' as $$
declare v_task public.job_tasks%rowtype; v_status text;
begin
  select * into v_task from public.job_tasks where id = p_task_id and lease_owner = p_worker_id for update;
  if not found then return 'lease_lost'; end if;
  v_status := case when p_retryable and v_task.attempt < v_task.max_attempts then 'retry_wait' when p_retryable then 'dead_lettered' else 'failed' end;
  update public.job_tasks set status = v_status, error_code = p_error_code, error_message = left(p_error_message,2000),
    next_attempt_at = case when v_status = 'retry_wait' then coalesce(p_next_attempt_at,now()+interval '1 minute') else null end,
    lease_owner = null, lease_expires_at = null, completed_at = case when v_status in ('failed','dead_lettered') then now() else null end
  where id = p_task_id;
  insert into public.processing_events (clip_job_id,job_task_id,stage,severity,message,attempt)
  values (v_task.clip_job_id,v_task.id,v_task.task_type,case when v_status='retry_wait' then 'warning' else 'error' end,left(p_error_message,2000),v_task.attempt);
  if v_status in ('failed','dead_lettered') then update public.clip_jobs set status = 'failed', error_code = p_error_code, error_message = left(p_error_message,2000), updated_at = now() where id = v_task.clip_job_id; end if;
  return v_status;
end;
$$;

create or replace function public.commit_source_usage(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_job public.clip_jobs%rowtype; v_period public.usage_periods%rowtype;
begin
  select * into v_job from public.clip_jobs where id = p_job_id for update;
  if not found or v_job.committed_source_seconds > 0 then return false; end if;
  select * into v_period from public.usage_periods where workspace_id = v_job.workspace_id and period_start <= v_job.created_at and period_end > v_job.created_at for update;
  update public.usage_periods set source_seconds_reserved = greatest(0,source_seconds_reserved-v_job.reserved_source_seconds), source_seconds_committed = source_seconds_committed+v_job.reserved_source_seconds, updated_at=now() where id=v_period.id;
  update public.clip_jobs set committed_source_seconds=reserved_source_seconds, reserved_source_seconds=0, updated_at=now() where id=p_job_id;
  insert into public.usage_ledger (workspace_id,user_id,job_id,category,amount,unit,direction,state,idempotency_key,description)
  values (v_job.workspace_id,v_job.user_id,v_job.id,'source_analysis',v_job.reserved_source_seconds,'seconds','debit','committed',v_job.id::text||':usage:commit','Source seconds committed') on conflict (idempotency_key) do nothing;
  return true;
end;
$$;

revoke all on function public.claim_clip_task(text,integer) from public, anon, authenticated;
revoke all on function public.start_clip_task(uuid,text) from public, anon, authenticated;
revoke all on function public.heartbeat_clip_task(uuid,text,integer,bigint,bigint) from public, anon, authenticated;
revoke all on function public.complete_clip_task(uuid,text,jsonb,jsonb,text,text) from public, anon, authenticated;
revoke all on function public.fail_clip_task(uuid,text,text,text,boolean,timestamptz) from public, anon, authenticated;
revoke all on function public.commit_source_usage(uuid) from public, anon, authenticated;
grant execute on function public.claim_clip_task(text,integer) to service_role;
grant execute on function public.start_clip_task(uuid,text) to service_role;
grant execute on function public.heartbeat_clip_task(uuid,text,integer,bigint,bigint) to service_role;
grant execute on function public.complete_clip_task(uuid,text,jsonb,jsonb,text,text) to service_role;
grant execute on function public.fail_clip_task(uuid,text,text,text,boolean,timestamptz) to service_role;
grant execute on function public.commit_source_usage(uuid) to service_role;

commit;
