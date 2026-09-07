begin;
alter table public.clip_candidates add column selection_key text;
create unique index clip_candidate_selection_key on public.clip_candidates(clip_job_id,origin,selection_key)
  where selection_key is not null;

create function public.materialize_exact_cut(
  p_task_id uuid,p_worker_id text,p_source_duration_seconds numeric,p_manifests jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_task public.job_tasks%rowtype;
  v_job public.clip_jobs%rowtype;
  v_range jsonb; v_manifest jsonb;
  v_candidate uuid; v_clip uuid; v_version uuid;
  v_index integer := 0; v_total numeric := 0; v_source_limit bigint;
  v_result jsonb := '[]'::jsonb;
begin
  select * into v_task from public.job_tasks where id=p_task_id and lease_owner=p_worker_id
    and status in ('leased','running') and lease_expires_at>now() and task_type='validate_source' for update;
  if not found then raise exception 'lease_lost' using errcode='55000'; end if;
  select * into v_job from public.clip_jobs where id=v_task.clip_job_id for update;
  if not found or v_job.status in ('failed','cancelled','expiring','expired') or v_job.retention_expires_at<=now()
    or v_job.settings_json->>'mode' is distinct from 'manual_timestamp'
    or v_job.creation_idempotency_key is null then
    raise exception 'exact_cut_not_available' using errcode='22023';
  end if;
  if not exists(select 1 from public.rights_attestations where clip_job_id=v_job.id and user_id=v_job.user_id
    and attestation_version='youtube-clipper-rights-v1' and policy_version='vidrial-content-policy-v1') then
    raise exception 'rights_attestation_required' using errcode='42501';
  end if;
  select p.max_source_seconds_per_job into v_source_limit from public.profiles pr join public.plans p on p.key=pr.plan_key where pr.id=v_job.user_id and p.active;
  if v_source_limit is null or p_source_duration_seconds is null or p_source_duration_seconds<=0
    or p_source_duration_seconds>v_source_limit then raise exception 'source_duration_limit' using errcode='22023'; end if;
  if jsonb_typeof(p_manifests) is distinct from 'array' then raise exception 'invalid_clip_manifests' using errcode='22023'; end if;
  if jsonb_array_length(p_manifests)<>v_job.requested_clip_count then raise exception 'invalid_clip_manifests' using errcode='22023'; end if;
  for v_range in select value from jsonb_array_elements(v_job.settings_json->'ranges') loop
    v_manifest := p_manifests->v_index;
    if jsonb_typeof(v_manifest) is distinct from 'object'
      or (v_manifest->>'startSeconds')::numeric is distinct from (v_range->>'startSeconds')::numeric
      or (v_manifest->>'endSeconds')::numeric is distinct from (v_range->>'endSeconds')::numeric
      or (v_range->>'endSeconds')::numeric>p_source_duration_seconds
      or coalesce(length(trim(v_manifest->>'title')),0) not between 1 and 120 then
      raise exception 'invalid_clip_manifests' using errcode='22023';
    end if;
    v_total := v_total+(v_range->>'endSeconds')::numeric-(v_range->>'startSeconds')::numeric;
    select id into v_candidate from public.clip_candidates where clip_job_id=v_job.id
      and origin='manual_timestamp' and selection_key='exact:'||v_index;
    if found then
      select id into v_clip from public.clips where clip_candidate_id=v_candidate and deleted_at is null;
      if not found then raise exception 'exact_cut_result_removed' using errcode='55000'; end if;
    else
      insert into public.clip_candidates(clip_job_id,origin,selection_key,start_seconds,end_seconds,title,rank,status)
        values(v_job.id,'manual_timestamp','exact:'||v_index,(v_range->>'startSeconds')::numeric,
          (v_range->>'endSeconds')::numeric,v_manifest->>'title',v_index+1,'selected') returning id into v_candidate;
      insert into public.clips(clip_job_id,clip_candidate_id,title,status,selected,duration_seconds)
        values(v_job.id,v_candidate,v_manifest->>'title','queued',true,(v_range->>'endSeconds')::numeric-(v_range->>'startSeconds')::numeric) returning id into v_clip;
      insert into public.clip_versions(clip_id,version_number,created_by,created_source,edit_manifest_json,
        transcript_edits_json,caption_settings_json,crop_settings_json,audio_settings_json,text_overlays_json)
        values(v_clip,1,v_job.user_id,'manual',v_manifest,'{}',v_manifest->'captions',
          jsonb_build_object('aspectRatio',v_manifest->'aspectRatio','cropMode',v_manifest->'cropMode','focalPoint',v_manifest->'focalPoint','safeArea',v_manifest->'safeArea'),
          v_manifest->'audio',coalesce(v_manifest->'textOverlays','[]'::jsonb)) returning id into v_version;
      update public.clips set current_version_id=v_version where id=v_clip;
    end if;
    v_result := v_result||jsonb_build_array(jsonb_build_object('clipId',v_clip,'candidateId',v_candidate));
    v_index := v_index+1;
  end loop;
  if v_index<>v_job.requested_clip_count or ceil(v_total)>v_job.reserved_source_seconds+v_job.committed_source_seconds then
    raise exception 'exact_cut_accounting_mismatch' using errcode='22023';
  end if;
  perform public.commit_source_usage(v_job.id);
  return v_result;
end $$;
revoke all on function public.materialize_exact_cut(uuid,text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.materialize_exact_cut(uuid,text,numeric,jsonb) to service_role;
commit;
