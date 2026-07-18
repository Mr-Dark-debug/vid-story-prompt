begin;

alter table public.processing_events
  add column if not exists proxy_tier text;

alter table public.processing_events
  drop constraint if exists processing_events_proxy_tier_check;
alter table public.processing_events
  add constraint processing_events_proxy_tier_check check (
    proxy_tier is null or proxy_tier in (
      'direct','operator','warp','render_warp','authorised_source'
    )
  );

create or replace function public.set_authorised_source_proxy_tier()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.proxy_tier is null and new.stage = 'authorised_source_attached' then
    new.proxy_tier := 'authorised_source';
  end if;
  return new;
end;
$$;

drop trigger if exists processing_events_authorised_source_proxy_tier
  on public.processing_events;
create trigger processing_events_authorised_source_proxy_tier
before insert or update of stage, proxy_tier on public.processing_events
for each row execute function public.set_authorised_source_proxy_tier();

update public.processing_events
set proxy_tier = 'authorised_source'
where stage = 'authorised_source_attached' and proxy_tier is null;

create or replace function public.complete_clip_task(
  p_task_id uuid, p_worker_id text, p_output jsonb default '{}'::jsonb,
  p_children jsonb default '[]'::jsonb, p_job_status text default null,
  p_message text default 'Task completed'
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_task public.job_tasks%rowtype; v_child jsonb; v_child_id uuid; v_proxy_tier text;
begin
  select * into v_task from public.job_tasks where id = p_task_id and lease_owner = p_worker_id for update;
  if not found then return false; end if;
  v_proxy_tier := nullif(p_output->>'proxyTier','');
  update public.job_tasks set status = 'succeeded', output_json = coalesce(p_output,'{}'::jsonb), completed_at = now(),
    lease_owner = null, lease_expires_at = null, heartbeat_at = now(), error_code = null, error_message = null where id = p_task_id;
  for v_child in select * from jsonb_array_elements(coalesce(p_children,'[]'::jsonb)) loop
    v_child_id := gen_random_uuid();
    insert into public.job_tasks (id,clip_job_id,task_type,status,priority,dependency_group,input_json,max_attempts,idempotency_key,next_attempt_at)
    values (v_child_id,v_task.clip_job_id,v_child->>'taskType','queued',coalesce((v_child->>'priority')::integer,v_task.priority),v_child->>'dependencyGroup',coalesce(v_child->'input','{}'::jsonb),coalesce((v_child->>'maxAttempts')::integer,5),coalesce(v_child->>'idempotencyKey',v_task.clip_job_id::text || ':' || (v_child->>'taskType') || ':' || v_child_id::text),now())
    on conflict (idempotency_key) do nothing;
    if found then
      insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload_json)
      values ('clip_job',v_task.clip_job_id,'task.queued',jsonb_build_object('jobId',v_task.clip_job_id,'taskId',v_child_id,'taskType',v_child->>'taskType'));
    end if;
  end loop;
  if p_job_status is not null then update public.clip_jobs set status = p_job_status, updated_at = now(), started_at = coalesce(started_at,now()) where id = v_task.clip_job_id; end if;
  insert into public.processing_events (clip_job_id,job_task_id,stage,severity,message,progress_current,progress_total,attempt,proxy_tier)
  values (v_task.clip_job_id,v_task.id,v_task.task_type,'info',p_message,v_task.progress_total,v_task.progress_total,v_task.attempt,v_proxy_tier);
  return true;
end;
$$;

create or replace function public.fail_clip_task(
  p_task_id uuid, p_worker_id text, p_error_code text, p_error_message text,
  p_retryable boolean, p_next_attempt_at timestamptz, p_proxy_tier text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_task public.job_tasks%rowtype;
  v_status text;
  v_publish_job_id uuid;
  v_recoverable_source boolean;
  v_force_escalation boolean;
begin
  if p_proxy_tier is not null and p_proxy_tier not in ('direct','operator','warp','render_warp','authorised_source') then
    raise exception 'invalid_proxy_tier' using errcode = '22023';
  end if;
  select * into v_task from public.job_tasks where id = p_task_id and lease_owner = p_worker_id for update;
  if not found then return 'lease_lost'; end if;
  v_force_escalation := p_retryable
    and v_task.task_type = 'download_youtube_source'
    and v_task.attempt >= v_task.max_attempts
    and coalesce((v_task.input_json->>'forceProxy')::boolean,false) = false;
  v_status := case
    when p_retryable and (v_task.attempt < v_task.max_attempts or v_force_escalation)
      then 'retry_wait'
    when p_retryable then 'dead_lettered'
    else 'failed'
  end;
  update public.job_tasks set status = v_status, error_code = p_error_code, error_message = left(p_error_message,2000),
    next_attempt_at = case when v_status = 'retry_wait' then coalesce(p_next_attempt_at,now()+interval '1 minute') else null end,
    lease_owner = null, lease_expires_at = null, completed_at = case when v_status in ('failed','dead_lettered') then now() else null end
    ,input_json = case when v_force_escalation then input_json || jsonb_build_object('forceProxy',true) else input_json end
    ,max_attempts = case when v_force_escalation then greatest(max_attempts,attempt+1) else max_attempts end
  where id = p_task_id;
  insert into public.processing_events (clip_job_id,job_task_id,stage,severity,message,attempt,proxy_tier)
  values (
    v_task.clip_job_id,v_task.id,v_task.task_type,
    case when v_status='retry_wait' then 'warning' else 'error' end,
    case when v_force_escalation
      then 'Player-client retries were exhausted. One protected-egress escalation is queued.'
      else left(p_error_message,2000) end,
    v_task.attempt,p_proxy_tier
  );

  v_recoverable_source := v_status in ('failed','dead_lettered') and (
    (v_task.task_type = 'download_youtube_source' and p_error_code in (
      'provider_auth_challenge','provider_rate_limited','provider_temporary_failure',
      'download_timeout','ytdlp_error','video_restricted','video_private',
      'video_age_restricted','video_unavailable'
    )) or p_error_code = 'source_match_confirmation_required'
  );

  if v_task.task_type = 'publish_youtube_video' then
    begin v_publish_job_id := nullif(v_task.input_json->>'publishingJobId','')::uuid;
    exception when invalid_text_representation then v_publish_job_id := null; end;
    if v_publish_job_id is not null then
      update public.publishing_jobs set
        status = case when v_status='retry_wait' then status when p_error_code='youtube_reconnect_required' then 'reconnect_required' else 'failed' end,
        last_error_code=p_error_code,last_error_message=left(p_error_message,2000),updated_at=now()
      where id=v_publish_job_id;
    end if;
  elsif v_recoverable_source then
    update public.clip_jobs set
      status='awaiting_authorised_source', error_code=p_error_code,
      error_message=case
        when p_error_code='source_match_confirmation_required' then left(p_error_message,2000)
        when p_error_code in ('video_private','video_age_restricted','video_unavailable')
          then 'This YouTube source cannot be acquired automatically. Attach an authorised original or owner-controlled media link to continue this same job.'
        else 'YouTube blocked this request from the server network after every configured egress path was tried. Attach an authorised original or owner-controlled media link to continue this same job.'
      end,
      updated_at=now()
    where id=v_task.clip_job_id;
    insert into public.processing_events (clip_job_id,job_task_id,stage,severity,message,attempt,proxy_tier)
    values (
      v_task.clip_job_id,v_task.id,'awaiting_authorised_source','warning',
      case when p_error_code='source_match_confirmation_required'
        then 'The attached file needs confirmation before processing can continue.'
        else 'Automatic acquisition stopped. This job is waiting for an authorised source.' end,
      v_task.attempt,p_proxy_tier
    );
  elsif v_status in ('failed','dead_lettered') then
    update public.clip_jobs set status='failed',error_code=p_error_code,error_message=left(p_error_message,2000),updated_at=now()
    where id=v_task.clip_job_id;
  end if;
  return v_status;
end;
$$;

drop function if exists public.retry_clip_task(uuid);
create function public.retry_clip_task(p_job_id uuid, p_force_proxy boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.clip_jobs%rowtype;
  v_task public.job_tasks%rowtype;
  v_force_available boolean;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_job from public.clip_jobs where id = p_job_id for update;
  if not found or v_job.user_id <> v_user_id or not public.is_workspace_member(v_job.workspace_id) then
    raise exception 'job_access_denied' using errcode = '42501';
  end if;
  if v_job.status in ('cancelled','expiring','expired','completed','ready') then
    raise exception 'retry_not_available' using errcode = '22023';
  end if;

  select * into v_task
  from public.job_tasks
  where clip_job_id = p_job_id and status in ('failed','dead_lettered')
  order by completed_at desc nulls last, created_at desc
  limit 1 for update;

  v_force_available := found
    and p_force_proxy
    and v_task.task_type = 'download_youtube_source'
    and coalesce((v_task.input_json->>'forceProxy')::boolean,false) = false;

  if not found
    or (v_task.attempt >= v_task.max_attempts and not v_force_available)
    or coalesce(v_task.error_code,'') not in (
      'provider_auth_challenge','provider_rate_limited','provider_temporary_failure',
      'download_timeout','ytdlp_error','video_restricted','plan_unavailable','temporary_failure'
    ) then
    raise exception 'retry_not_available' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.job_tasks active
    where active.clip_job_id = p_job_id and active.id <> v_task.id
      and active.status in ('pending','queued','leased','running','retry_wait')
  ) then
    raise exception 'retry_already_active' using errcode = '55000';
  end if;

  update public.job_tasks
  set status='queued', next_attempt_at=now(), lease_owner=null, lease_expires_at=null,
      heartbeat_at=null, error_code=null, error_message=null, completed_at=null,
      progress_current=null, progress_total=null,
      max_attempts=case when v_force_available then greatest(max_attempts,attempt+1) else max_attempts end,
      input_json=case when p_force_proxy then input_json || jsonb_build_object('forceProxy',true) else input_json end
  where id=v_task.id;

  update public.clip_jobs set status='queued',error_code=null,error_message=null,completed_at=null,updated_at=now()
  where id=p_job_id;
  insert into public.processing_events (clip_job_id,job_task_id,stage,severity,message,attempt)
  values (
    p_job_id,v_task.id,v_task.task_type,'info',
    case when p_force_proxy then 'Protected egress retry requested. The task is queued.'
      else 'Retry requested. The task is queued for another attempt.' end,
    v_task.attempt+1
  );
  insert into public.outbox_events (aggregate_type,aggregate_id,event_type,payload_json)
  values ('clip_job',p_job_id,'task.queued',jsonb_build_object(
    'jobId',p_job_id,'taskId',v_task.id,'taskType',v_task.task_type,
    'manualRetry',true,'forceProxy',p_force_proxy
  ));
  return jsonb_build_object(
    'taskId',v_task.id,'jobId',p_job_id,'status','queued','attempt',v_task.attempt,
    'maxAttempts',case when v_force_available then greatest(v_task.max_attempts,v_task.attempt+1) else v_task.max_attempts end,
    'forceProxy',p_force_proxy
  );
end;
$$;

revoke all on function public.fail_clip_task(uuid,text,text,text,boolean,timestamptz,text) from public,anon,authenticated;
grant execute on function public.fail_clip_task(uuid,text,text,text,boolean,timestamptz,text) to service_role;
revoke all on function public.retry_clip_task(uuid,boolean) from public,anon;
grant execute on function public.retry_clip_task(uuid,boolean) to authenticated;

commit;
