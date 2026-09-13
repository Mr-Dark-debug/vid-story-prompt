begin;
do $$
declare
  v_job uuid; v_task uuid; v_state text; v_message text;
  v_case record;
begin
  for v_case in select * from (values
    ('provider_auth_challenge','anti-bot'),
    ('provider_access_denied','HTTP 403'),
    ('provider_rate_limited','limited the number'),
    ('provider_temporary_failure','timed out'),
    ('provider_unknown_failure','unrecognized reason'),
    ('video_private','video is private'),
    ('video_age_restricted','age-restricted'),
    ('video_region_restricted','worker region'),
    ('video_unavailable','unavailable or has been removed'),
    ('video_drm_protected','DRM-protected')
  ) as cases(code, expected) loop
    v_job := gen_random_uuid(); v_task := gen_random_uuid();
    insert into public.clip_jobs(id,status) values(v_job,'queued');
    insert into public.job_tasks(id,clip_job_id,task_type,lease_owner,status,attempt,max_attempts)
    values(v_task,v_job,'download_youtube_source','test-worker','running',1,5);
    v_state := public.fail_clip_task(v_task,'test-worker',v_case.code,'untrusted provider detail',false,null,'direct');
    if v_state <> 'failed' then raise exception 'Wrong task state for %',v_case.code; end if;
    select error_message into v_message from public.clip_jobs where id=v_job and status='awaiting_authorised_source';
    if v_message is null or position(v_case.expected in v_message)=0 or position('untrusted provider detail' in v_message)>0 then
      raise exception 'Wrong customer reason for %: %',v_case.code,v_message;
    end if;
    if (select reserved_source_seconds from public.clip_jobs where id=v_job)<>60 then
      raise exception 'Source recovery changed reservation';
    end if;
    if public.fail_clip_task(v_task,'test-worker',v_case.code,'duplicate',false,null,'direct')<>'lease_lost' then
      raise exception 'Repeated callback must not overwrite finished task';
    end if;
  end loop;
  v_job:=gen_random_uuid(); v_task:=gen_random_uuid();
  insert into public.clip_jobs(id,status) values(v_job,'queued');
  insert into public.job_tasks(id,clip_job_id,task_type,lease_owner,status,attempt,max_attempts)
  values(v_task,v_job,'download_youtube_source','test-worker','running',1,5);
  v_state:=public.fail_clip_task(v_task,'test-worker','provider_rate_limited','raw',true,now()+interval '30 seconds','warp');
  if v_state<>'retry_wait' or not exists(select 1 from public.job_tasks where id=v_task and next_attempt_at>now()) then
    raise exception 'Transient retry was not scheduled with backoff';
  end if;
  update public.clip_jobs set status='cancelled' where id=v_job;
  update public.job_tasks set status='running',lease_owner='test-worker' where id=v_task;
  perform public.fail_clip_task(v_task,'test-worker','provider_rate_limited','raw',false,null,'warp');
  if (select status from public.clip_jobs where id=v_job)<>'cancelled' then
    raise exception 'Failure callback resurrected a cancelled job';
  end if;
  if has_function_privilege('anon','public.fail_clip_task(uuid,text,text,text,boolean,timestamptz,text)','execute')
    or has_function_privilege('authenticated','public.fail_clip_task(uuid,text,text,text,boolean,timestamptz,text)','execute') then
    raise exception 'Worker RPC exposed to browser roles';
  end if;
end;
$$;
rollback;
