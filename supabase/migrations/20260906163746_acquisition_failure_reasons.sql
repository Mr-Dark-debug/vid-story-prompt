begin;

-- Retain the classified reason. A failed request alone is not proof of an IP block.
-- Preserve source recovery, reservation and publishing isolation behavior.
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
  v_message text;
begin
  if p_proxy_tier is not null and p_proxy_tier not in ('direct','operator','warp','render_warp','authorised_source') then
    raise exception 'invalid_proxy_tier' using errcode = '22023';
  end if;
  select * into v_task from public.job_tasks
  where id = p_task_id and lease_owner = p_worker_id and status in ('leased','running')
  for update;
  if not found then return 'lease_lost'; end if;
  v_message := case p_error_code
    when 'provider_auth_challenge' then 'YouTube requested a sign-in or anti-bot check from the server. Connecting a YouTube account does not unlock this download.'
    when 'provider_access_denied' then 'YouTube rejected this media request (HTTP 403). The precise cause is not confirmed.'
    when 'provider_rate_limited' then 'YouTube temporarily limited the number of requests from the worker.'
    when 'provider_temporary_failure' then 'The source request timed out or the provider was temporarily unavailable.'
    when 'provider_unknown_failure' then 'The source request failed for an unrecognized reason. A network block has not been confirmed.'
    when 'video_private' then 'This video is private and cannot be imported automatically.'
    when 'video_age_restricted' then 'This video is age-restricted. Vidrial does not bypass age restrictions.'
    when 'video_region_restricted' then 'This video is unavailable in the worker region. Vidrial does not bypass geographic restrictions.'
    when 'video_unavailable' then 'This video is unavailable or has been removed by its provider.'
    when 'video_drm_protected' then 'This video is DRM-protected. Vidrial does not bypass copy protection.'
    else left(p_error_message,2000)
  end;
  v_force_escalation := p_retryable
    and v_task.task_type = 'download_youtube_source'
    and v_task.attempt >= v_task.max_attempts
    and coalesce((v_task.input_json->>'forceProxy')::boolean,false) = false;
  v_status := case
    when p_retryable and (v_task.attempt < v_task.max_attempts or v_force_escalation) then 'retry_wait'
    when p_retryable then 'dead_lettered'
    else 'failed'
  end;
  update public.job_tasks set status = v_status, error_code = p_error_code, error_message = v_message,
    next_attempt_at = case when v_status = 'retry_wait' then coalesce(p_next_attempt_at,now()+interval '1 minute') else null end,
    lease_owner = null, lease_expires_at = null,
    completed_at = case when v_status in ('failed','dead_lettered') then now() else null end,
    input_json = case when v_force_escalation then input_json || jsonb_build_object('forceProxy',true) else input_json end,
    max_attempts = case when v_force_escalation then greatest(max_attempts,attempt+1) else max_attempts end
  where id = p_task_id;
  insert into public.processing_events (clip_job_id,job_task_id,stage,severity,message,attempt,proxy_tier)
  values (v_task.clip_job_id,v_task.id,v_task.task_type,
    case when v_status='retry_wait' then 'warning' else 'error' end,
    v_message || case when v_status='retry_wait' then ' A retry is scheduled after a delay.' else '' end,
    v_task.attempt,p_proxy_tier);

  v_recoverable_source := v_status in ('failed','dead_lettered') and (
    (v_task.task_type = 'download_youtube_source' and p_error_code in (
      'provider_auth_challenge','provider_access_denied','provider_rate_limited',
      'provider_temporary_failure','provider_unknown_failure','download_timeout',
      'ytdlp_error','video_restricted','video_private','video_age_restricted',
      'video_unavailable','video_region_restricted','video_drm_protected'
    )) or p_error_code = 'source_match_confirmation_required'
  );
  if v_task.task_type in ('publish_youtube_video','publish_social_video') then
    begin v_publish_job_id := nullif(v_task.input_json->>'publishingJobId','')::uuid;
    exception when invalid_text_representation then v_publish_job_id := null; end;
    if v_publish_job_id is not null then
      update public.publishing_jobs set
        status = case when v_status='retry_wait' then status
          when p_error_code like '%reconnect_required' then 'reconnect_required' else 'failed' end,
        last_error_code=p_error_code,last_error_message=v_message,updated_at=now()
      where id=v_publish_job_id;
    end if;
  elsif v_recoverable_source then
    update public.clip_jobs set status='awaiting_authorised_source', error_code=p_error_code,
      error_message=v_message || ' Attach an authorised original or owner-controlled media link to continue this same job.',
      updated_at=now()
    where id=v_task.clip_job_id and status not in ('cancelled','expiring','expired');
    if found then
      insert into public.processing_events (clip_job_id,job_task_id,stage,severity,message,attempt,proxy_tier)
      values (v_task.clip_job_id,v_task.id,'awaiting_authorised_source','warning',
        'Automatic acquisition stopped. This job is waiting for an authorised source.',v_task.attempt,p_proxy_tier);
    end if;
  elsif v_status in ('failed','dead_lettered') then
    update public.clip_jobs set status='failed',error_code=p_error_code,error_message=v_message,updated_at=now()
    where id=v_task.clip_job_id and status not in ('cancelled','expiring','expired');
  end if;
  return v_status;
end;
$$;

revoke all on function public.fail_clip_task(uuid,text,text,text,boolean,timestamptz,text) from public,anon,authenticated;
grant execute on function public.fail_clip_task(uuid,text,text,text,boolean,timestamptz,text) to service_role;

commit;
