begin;
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000001','a@example.test'),('00000000-0000-4000-8000-000000000002','b@example.test');
insert into public.workspaces(id,name,owner_id) values
  ('10000000-0000-4000-8000-000000000001','A','00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002','B','00000000-0000-4000-8000-000000000002');
insert into public.media_assets(id,workspace_id,user_id,source_type,display_name,storage_bucket,storage_path,status) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','local_upload','Test source','source-media','10000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001/fixture/source/file.mp4','uploaded'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','local_upload','Other source','source-media','10000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000002/fixture/source/file.mp4','uploaded');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);

-- Calling helper retains auth.uid and exercises the actual production RPC.
create function public.test_exact_job(settings jsonb,request_key text,source_seconds bigint default 600,clip_count integer default 5,asset uuid default '20000000-0000-4000-8000-000000000001') returns uuid
language sql as $$
  select public.create_clip_job('10000000-0000-4000-8000-000000000001','local_upload',null,null,source_seconds,asset,
    '{"title":"Source"}',settings,clip_count,'youtube-clipper-rights-v1','vidrial-content-policy-v1','{}',request_key);
$$;
do $$
declare
  v_job uuid; v_again uuid; v_task uuid; v_results jsonb; v_replay jsonb; v_manifests jsonb;
  v_settings jsonb := '{"mode":"manual_timestamp","ranges":[{"startSeconds":0,"endSeconds":10},{"startSeconds":10,"endSeconds":20},{"startSeconds":20,"endSeconds":30},{"startSeconds":30,"endSeconds":40},{"startSeconds":40,"endSeconds":50}]}';
  v_case jsonb;
begin
  v_job := public.test_exact_job(v_settings,'five-ranges');
  if not exists(select 1 from public.clip_jobs where id=v_job and source_duration_seconds=600 and reserved_source_seconds=50 and watermark_required
    and export_limit_json->>'height'='720' and retention_expires_at<now()+interval '8 days') then
    raise exception 'Wrong manual duration, watermark or retention';
  end if;
  if (select source_seconds_reserved from public.usage_periods where workspace_id='10000000-0000-4000-8000-000000000001')<>50 then raise exception 'Wrong reservation'; end if;
  if (select count(*) from public.rights_attestations where clip_job_id=v_job)<>1 then raise exception 'Rights missing'; end if;
  v_again := public.test_exact_job(v_settings,'five-ranges');
  if v_again<>v_job or (select count(*) from public.usage_ledger where job_id=v_job)<>1
    or (select count(*) from public.job_tasks where clip_job_id=v_job)<>1 then raise exception 'Retry duplicated job, charge or task'; end if;
  begin
    perform public.test_exact_job(v_settings,'five-ranges',601);
    raise exception 'Changed idempotent request accepted';
  exception when invalid_parameter_value then
    if sqlerrm<>'idempotency_key_conflict' then raise; end if;
  end;
  select id into v_task from public.job_tasks where clip_job_id=v_job;
  update public.job_tasks set status='running',lease_owner='worker-test',lease_expires_at=now()+interval '5 minutes' where id=v_task;
  select jsonb_agg(jsonb_build_object('title','Selected clip','startSeconds',value->'startSeconds','endSeconds',value->'endSeconds','captions','{}'::jsonb,'audio','{}'::jsonb))
    into v_manifests from jsonb_array_elements(v_settings->'ranges');
  begin
    perform public.materialize_exact_cut(v_task,'wrong-worker',600,v_manifests);
    raise exception 'Wrong lease owner accepted';
  exception when object_not_in_prerequisite_state then null; end;
  begin
    perform public.materialize_exact_cut(v_task,'worker-test',49,v_manifests);
    raise exception 'Out-of-source range accepted';
  exception when invalid_parameter_value then null; end;
  if exists(select 1 from public.clips where clip_job_id=v_job) then raise exception 'Failed batch left partial clips'; end if;
  v_results:=public.materialize_exact_cut(v_task,'worker-test',600,v_manifests);
  v_replay:=public.materialize_exact_cut(v_task,'worker-test',600,v_manifests);
  if v_results<>v_replay or jsonb_array_length(v_results)<>5
    or (select count(*) from public.clips where clip_job_id=v_job)<>5
    or (select count(*) from public.clip_versions cv join public.clips c on c.id=cv.clip_id where c.clip_job_id=v_job)<>5
    or exists(select 1 from public.planning_runs where clip_job_id=v_job)
    or exists(select 1 from public.clip_candidates where clip_job_id=v_job and (origin<>'manual_timestamp' or overall_score is not null)) then
    raise exception 'Manual clips were duplicated, scored or planned';
  end if;
  perform public.commit_source_usage(v_job);
  if not exists(select 1 from public.clip_jobs where id=v_job and reserved_source_seconds=0 and committed_source_seconds=50)
    or (select count(*) from public.usage_ledger where job_id=v_job and state='committed')<>1 then raise exception 'Wrong or repeated committed usage'; end if;
  update public.clip_jobs set status='ready' where id=v_job;
  v_job := public.test_exact_job('{"mode":"manual_timestamp","ranges":[{"startSeconds":0,"endSeconds":0.1},{"startSeconds":0,"endSeconds":0.2},{"startSeconds":0,"endSeconds":0.7}]}','fractions',600,3);
  if (select reserved_source_seconds from public.clip_jobs where id=v_job)<>1 then raise exception 'Must sum overlapping ranges and round once'; end if;
  update public.clip_jobs set status='failed' where id=v_job;
  if (select reserved_source_seconds from public.clip_jobs where id=v_job)<>0 then raise exception 'Failed source did not release exact reservation'; end if;
  if (select source_seconds_reserved from public.usage_periods where workspace_id='10000000-0000-4000-8000-000000000001')<>0 then raise exception 'Period reservation not released'; end if;
  foreach v_case in array array[
    '{"mode":"manual_timestamp","ranges":[{"startSeconds":10,"endSeconds":0}]}'::jsonb,
    '{"mode":"manual_timestamp","ranges":[{"startSeconds":0,"endSeconds":601}]}'::jsonb,
    '{"mode":"manual_timestamp","ranges":[{"startSeconds":"0","endSeconds":1}]}'::jsonb,
    '{"mode":"manual_timestamp","ranges":[]}'::jsonb,
    '{"mode":"manual_timestamp","ranges":[{"startSeconds":0.0001,"endSeconds":1}]}'::jsonb
  ] loop
    begin
      perform public.test_exact_job(v_case,gen_random_uuid()::text,600,1);
      raise exception 'Invalid range accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.test_exact_job(v_settings,'long-source',1801);
    raise exception 'Short selected duration bypassed full source cap';
  exception when invalid_parameter_value then
    if sqlerrm<>'plan_limit_exceeded' then raise; end if;
  end;
  begin
    perform public.test_exact_job(v_settings,'foreign-asset',600,5,'20000000-0000-4000-8000-000000000002');
    raise exception 'Foreign asset accepted';
  exception when insufficient_privilege then null; end;
  update public.usage_periods set source_seconds_committed=3590 where workspace_id='10000000-0000-4000-8000-000000000001';
  begin
    perform public.test_exact_job(v_settings,'over-quota');
    raise exception 'Over-quota job accepted';
  exception when invalid_parameter_value then
    if sqlerrm<>'insufficient_usage' then raise; end if;
  end;
  update public.usage_periods set source_seconds_committed=50 where workspace_id='10000000-0000-4000-8000-000000000001';
  v_job := public.test_exact_job('{}','discovery',600,1);
  if (select reserved_source_seconds from public.clip_jobs where id=v_job)<>600 then raise exception 'Discovery no longer meters full source'; end if;
  begin
    perform public.test_exact_job(v_settings,'concurrent');
    raise exception 'Concurrent job cap bypassed';
  exception when invalid_parameter_value then
    if sqlerrm<>'concurrent_job_limit_exceeded' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
  begin
    perform public.test_exact_job(v_settings,'foreign-workspace');
    raise exception 'Foreign workspace accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',false);
  begin
    perform public.test_exact_job(v_settings,'unauthenticated');
    raise exception 'Unauthenticated request accepted';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('anon','public.create_clip_job(uuid,text,text,text,bigint,uuid,jsonb,jsonb,integer,text,text,jsonb,text)','execute') then
    raise exception 'Anonymous role can execute job creation';
  end if;
  if has_function_privilege('authenticated','public.materialize_exact_cut(uuid,text,numeric,jsonb)','execute') then
    raise exception 'Browser role can materialize worker results';
  end if;
end $$;

-- Exercise the real foundation RLS and new immutable-contract trigger as a
-- browser role, not just a privileged caller carrying a simulated auth.uid.
grant select,update on public.clip_jobs to authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
set local role authenticated;
do $$ begin
  begin
    update public.clip_jobs set settings_json='{}' where creation_idempotency_key='five-ranges';
    raise exception 'Browser rewrote paid range contract';
  exception when insufficient_privilege then
    if sqlerrm<>'immutable_job_contract' then raise; end if;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.clip_jobs where creation_idempotency_key='five-ranges') then
    raise exception 'RLS exposed another workspace job';
  end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
set local role authenticated;
update public.clip_jobs set status='cancelled' where creation_idempotency_key='discovery';
update public.clip_jobs set status='cancelled' where creation_idempotency_key='discovery';
reset role;
do $$ declare v_job uuid; begin
  select id into v_job from public.clip_jobs where creation_idempotency_key='discovery';
  if not exists(select 1 from public.clip_jobs where id=v_job and reserved_source_seconds=0 and committed_source_seconds=0)
    or (select count(*) from public.usage_ledger where job_id=v_job and state='released')<>1 then
    raise exception 'Early cancellation did not release exactly once';
  end if;
  if public.commit_source_usage(v_job) then raise exception 'Cancelled work was charged'; end if;
end $$;
grant select,insert on public.clip_versions to authenticated;
grant select on public.clip_candidates to authenticated;
grant select,update,insert on public.clips to authenticated;
set local role authenticated;
do $$ declare v_clip uuid; v_other_clip uuid; v_version uuid; begin
  select c.id into v_clip from public.clips c join public.clip_jobs j on j.id=c.clip_job_id
    join public.clip_candidates ca on ca.id=c.clip_candidate_id
    where j.creation_idempotency_key='five-ranges' and ca.selection_key='exact:0';
  insert into public.clip_versions(clip_id,version_number,created_by,created_source,edit_manifest_json)
    values(v_clip,2,auth.uid(),'manual','{"startSeconds":0,"endSeconds":15}') returning id into v_version;
  insert into public.clip_versions(clip_id,version_number,created_by,created_source,edit_manifest_json)
    values(v_clip,3,auth.uid(),'manual','{"startSeconds":0,"endSeconds":8}');
  insert into public.clip_versions(clip_id,version_number,created_by,created_source,edit_manifest_json)
    values(v_clip,4,auth.uid(),'restore','{"startSeconds":0,"endSeconds":15}');
  if (select duration_seconds from public.clip_processing_allowances where clip_id=v_clip)<>15 then
    raise exception 'Shortening or restoring charged again';
  end if;
  insert into public.clip_versions(clip_id,version_number,created_by,created_source,edit_manifest_json)
    values(v_clip,5,auth.uid(),'manual','{"startSeconds":0,"endSeconds":15.1}');
  insert into public.clip_versions(clip_id,version_number,created_by,created_source,edit_manifest_json)
    values(v_clip,6,auth.uid(),'manual','{"startSeconds":0,"endSeconds":15.9}');
  if (select duration_seconds from public.clip_processing_allowances where clip_id=v_clip)<>16 then
    raise exception 'Rounded extension allowance was charged twice';
  end if;
  begin
    update public.clip_processing_allowances set duration_seconds=600 where clip_id=v_clip;
    raise exception 'Browser forged paid duration';
  exception when insufficient_privilege then null; end;
  select id into v_other_clip from public.clips where id<>v_clip limit 1;
  if not public.activate_clip_version(v_clip,v_version) then raise exception 'Saved version not activated'; end if;
  if (select current_version_id from public.clips where id=v_clip) is distinct from v_version then raise exception 'Current version unchanged'; end if;
  begin
    perform public.activate_clip_version(v_other_clip,v_version);
    raise exception 'Cross-clip version accepted';
  exception when insufficient_privilege then
    if sqlerrm<>'clip_version_mismatch' then raise; end if;
  end;
  begin
    insert into public.clips(clip_job_id,clip_candidate_id,title,status,duration_seconds)
      select clip_job_id,clip_candidate_id,'Unauthorized copy','ready',10 from public.clips where id=v_clip;
    raise exception 'Browser bypassed worker materialization';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.clip_versions(clip_id,version_number,created_by,created_source,edit_manifest_json)
      values(v_clip,7,auth.uid(),'manual','{"startSeconds":0,"endSeconds":601}');
    raise exception 'Out of source range saved';
  exception when invalid_parameter_value then
    if sqlerrm<>'invalid_clip_range' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if (select committed_source_seconds from public.clip_jobs where creation_idempotency_key='five-ranges')<>56 then
    raise exception 'Extension did not debit only additional seconds';
  end if;
end $$;
update public.usage_periods set source_seconds_committed=3599 where workspace_id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ declare v_clip uuid; begin
  select clip_id into v_clip from public.clip_processing_allowances where duration_seconds=16;
  begin
    insert into public.clip_versions(clip_id,version_number,created_by,created_source,edit_manifest_json)
      values(v_clip,7,auth.uid(),'manual','{"startSeconds":0,"endSeconds":18}');
    raise exception 'Over-quota extension saved';
  exception when invalid_parameter_value then
    if sqlerrm not like 'Not enough processing minutes%' then raise; end if;
  end;
  if (select duration_seconds from public.clip_processing_allowances where clip_id=v_clip)<>16 then
    raise exception 'Rejected save changed allowance';
  end if;
end $$;
reset role;
rollback;
