begin;
create or replace function public.request_batch_export(p_job_id uuid,p_clip_ids uuid[],p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_job public.clip_jobs%rowtype;v_profile public.profiles%rowtype;v_plan public.plans%rowtype;v_render_id uuid;v_export_id uuid;v_task_id uuid;v_count integer;
begin
  select * into v_job from public.clip_jobs where id=p_job_id and user_id=v_user and public.is_workspace_member(workspace_id);
  if not found then raise exception 'job_access_denied' using errcode='42501';end if;
  select count(*) into v_count from public.clips where id=any(p_clip_ids) and clip_job_id=p_job_id and current_version_id is not null and deleted_at is null;
  if v_count=0 or v_count<>cardinality(p_clip_ids) then raise exception 'invalid_batch_selection' using errcode='22023';end if;
  select * into v_profile from public.profiles where id=v_user;select * into v_plan from public.plans where key=v_profile.plan_key;
  insert into public.render_jobs(clip_job_id,render_type,status,settings_json,watermark_required,idempotency_key)
  values(p_job_id,'batch_zip','queued',jsonb_build_object('clipIds',p_clip_ids,'planKey',v_plan.key),v_plan.watermark_required,p_idempotency_key||':render') returning id into v_render_id;
  insert into public.exports(workspace_id,user_id,clip_job_id,render_job_id,export_type,format,resolution,frame_rate,caption_mode,watermarked,status,expires_at)
  values(v_job.workspace_id,v_user,p_job_id,v_render_id,'batch','zip','mixed',v_plan.max_export_fps,'both',v_plan.watermark_required,'queued',v_job.retention_expires_at) returning id into v_export_id;
  v_task_id:=gen_random_uuid();insert into public.job_tasks(id,clip_job_id,task_type,status,priority,input_json,idempotency_key,next_attempt_at)
  values(v_task_id,p_job_id,'render_batch_export','queued',v_plan.priority,jsonb_build_object('renderJobId',v_render_id,'exportId',v_export_id,'clipIds',p_clip_ids),p_idempotency_key||':task',now());
  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload_json) values('render_job',v_render_id,'task.queued',jsonb_build_object('jobId',p_job_id,'taskId',v_task_id,'taskType','render_batch_export'));
  return jsonb_build_object('exportId',v_export_id,'renderJobId',v_render_id,'clipCount',v_count,'watermarked',v_plan.watermark_required);
end;$$;
grant execute on function public.request_batch_export(uuid,uuid[],text) to authenticated;
commit;
