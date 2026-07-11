begin;

create or replace function public.request_clip_export(
  p_clip_id uuid, p_clip_version_id uuid, p_export_type text,
  p_caption_mode text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_clip public.clips%rowtype; v_job public.clip_jobs%rowtype;
  v_profile public.profiles%rowtype; v_plan public.plans%rowtype; v_render_id uuid; v_export_id uuid;
  v_watermark boolean; v_trial_consumed boolean := false; v_task_id uuid;
begin
  select * into v_clip from public.clips where id = p_clip_id and deleted_at is null;
  select * into v_job from public.clip_jobs where id = v_clip.clip_job_id;
  if v_user is null or v_job.user_id <> v_user or not public.is_workspace_member(v_job.workspace_id) then raise exception 'clip_access_denied' using errcode='42501'; end if;
  if p_clip_version_id is null or not exists (select 1 from public.clip_versions where id=p_clip_version_id and clip_id=p_clip_id) then raise exception 'valid_clip_version_required' using errcode='22023'; end if;
  select * into v_profile from public.profiles where id=v_user for update;
  select * into v_plan from public.plans where key=v_profile.plan_key and active;
  v_watermark := v_plan.watermark_required;
  if v_watermark and v_profile.trial_unwatermarked_exports_used < v_plan.trial_unwatermarked_exports then
    update public.profiles set trial_unwatermarked_exports_used=trial_unwatermarked_exports_used+1,updated_at=now() where id=v_user;
    v_watermark := false; v_trial_consumed := true;
  end if;
  insert into public.render_jobs (clip_job_id,clip_id,clip_version_id,render_type,status,settings_json,watermark_required,idempotency_key)
  values (v_job.id,v_clip.id,p_clip_version_id,'final','queued',jsonb_build_object('width',v_plan.max_export_width,'height',v_plan.max_export_height,'fps',v_plan.max_export_fps,'captionMode',p_caption_mode,'planKey',v_plan.key,'trialConsumed',v_trial_consumed),v_watermark,p_idempotency_key||':render')
  on conflict (idempotency_key) do update set idempotency_key=excluded.idempotency_key returning id into v_render_id;
  insert into public.exports (workspace_id,user_id,clip_job_id,clip_id,render_job_id,export_type,format,resolution,frame_rate,caption_mode,watermarked,status,expires_at)
  values (v_job.workspace_id,v_user,v_job.id,v_clip.id,v_render_id,p_export_type,'mp4',v_plan.max_export_width||'x'||v_plan.max_export_height,v_plan.max_export_fps,p_caption_mode,v_watermark,'queued',v_job.retention_expires_at)
  returning id into v_export_id;
  v_task_id:=gen_random_uuid();
  insert into public.job_tasks(id,clip_job_id,task_type,status,priority,input_json,idempotency_key,next_attempt_at)
  values(v_task_id,v_job.id,'render_clip_export','queued',v_plan.priority,jsonb_build_object('renderJobId',v_render_id,'exportId',v_export_id),p_idempotency_key||':task',now());
  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload_json)
  values('render_job',v_render_id,'task.queued',jsonb_build_object('jobId',v_job.id,'taskId',v_task_id,'taskType','render_clip_export'));
  update public.clip_jobs set status='exporting',updated_at=now() where id=v_job.id;
  return jsonb_build_object('exportId',v_export_id,'renderJobId',v_render_id,'watermarked',v_watermark,'trialConsumed',v_trial_consumed,'resolution',v_plan.max_export_width||'x'||v_plan.max_export_height);
end;
$$;

create or replace function public.request_job_deletion(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_job public.clip_jobs%rowtype; v_task_id uuid:=gen_random_uuid();
begin
  select * into v_job from public.clip_jobs where id=p_job_id and user_id=auth.uid() and public.is_workspace_member(workspace_id) for update;
  if not found then raise exception 'job_access_denied' using errcode='42501'; end if;
  update public.clip_jobs set status='expiring',updated_at=now() where id=p_job_id;
  update public.job_tasks set status='cancelled',completed_at=now() where clip_job_id=p_job_id and status in('pending','queued','leased','running','retry_wait');
  insert into public.job_tasks(id,clip_job_id,task_type,status,priority,input_json,idempotency_key,next_attempt_at)
  values(v_task_id,p_job_id,'delete_expired_assets','queued',100,jsonb_build_object('immediate',true),p_job_id::text||':delete',now()) on conflict(idempotency_key) do update set status='queued',next_attempt_at=now();
  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload_json)
  values('clip_job',p_job_id,'task.queued',jsonb_build_object('jobId',p_job_id,'taskId',v_task_id,'taskType','delete_expired_assets'));
  return true;
end;
$$;

create or replace function public.enqueue_expired_clip_jobs(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_job record; v_count integer:=0; v_task_id uuid;
begin
  for v_job in select id from public.clip_jobs where retention_expires_at<=now() and status not in('expiring','expired') order by retention_expires_at limit p_limit for update skip locked loop
    update public.clip_jobs set status='expiring',updated_at=now() where id=v_job.id;
    update public.job_tasks set status='cancelled',completed_at=now() where clip_job_id=v_job.id and status in('pending','queued','leased','running','retry_wait');
    v_task_id:=gen_random_uuid();
    insert into public.job_tasks(id,clip_job_id,task_type,status,priority,input_json,idempotency_key,next_attempt_at) values(v_task_id,v_job.id,'delete_expired_assets','queued',100,'{}',v_job.id::text||':delete',now()) on conflict(idempotency_key) do update set status='queued',next_attempt_at=now();
    insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload_json) values('clip_job',v_job.id,'task.queued',jsonb_build_object('jobId',v_job.id,'taskId',v_task_id,'taskType','delete_expired_assets'));
    v_count:=v_count+1;
  end loop; return v_count;
end;
$$;

create or replace function public.release_early_failed_usage()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_period_id uuid;
begin
  if new.status='failed' and old.status<>'failed' and new.committed_source_seconds=0 and new.reserved_source_seconds>0 then
    select id into v_period_id from public.usage_periods where workspace_id=new.workspace_id and period_start<=new.created_at and period_end>new.created_at for update;
    update public.usage_periods set source_seconds_reserved=greatest(0,source_seconds_reserved-new.reserved_source_seconds),updated_at=now() where id=v_period_id;
    insert into public.usage_ledger(workspace_id,user_id,job_id,category,amount,unit,direction,state,idempotency_key,description)
    values(new.workspace_id,new.user_id,new.id,'source_analysis',new.reserved_source_seconds,'seconds','credit','released',new.id::text||':usage:release','Reserved source seconds released after early failure') on conflict(idempotency_key) do nothing;
    new.reserved_source_seconds:=0;
  end if; return new;
end;
$$;
create trigger clip_job_release_early_usage before update of status on public.clip_jobs for each row execute procedure public.release_early_failed_usage();

grant execute on function public.request_clip_export(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.request_job_deletion(uuid) to authenticated;
revoke all on function public.enqueue_expired_clip_jobs(integer) from public,anon,authenticated;
grant execute on function public.enqueue_expired_clip_jobs(integer) to service_role;

commit;
