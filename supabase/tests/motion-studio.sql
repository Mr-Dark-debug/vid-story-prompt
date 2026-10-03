begin;
-- Plain PostgreSQL has no Supabase default grants; reproduce read grants for the
-- unchanged foundation policies while preserving motion's deliberate revocations.
grant select on public.profiles,public.workspaces,public.workspace_members to authenticated;
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000001','a@example.test'),('00000000-0000-4000-8000-000000000002','b@example.test');
insert into public.workspaces(id,name,owner_id) values('10000000-0000-4000-8000-000000000001','Motion A','00000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002','Motion B','00000000-0000-4000-8000-000000000002');
insert into public.motion_prompts(id,slug,title,prompt,category,aspect,duration_seconds,source,license,status,author_display_name) values
 ('20000000-0000-4000-8000-000000000001','approved-study','Approved','An original study','showreel','16:9',5,'official','vidrial_original','approved','Vidrial'),
 ('20000000-0000-4000-8000-000000000002','pending-study','Pending','Pending original','showreel','16:9',5,'official','vidrial_original','pending','Vidrial');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
create temporary table motion_test_ids(project_id uuid,version_id uuid,task_id uuid,lease_token uuid,render_id uuid);
grant select,update,insert on motion_test_ids to authenticated;
set local role authenticated;
insert into motion_test_ids(project_id) select (public.create_motion_project('10000000-0000-4000-8000-000000000001','Study','Five seconds of shapes','manual','{"width":1280,"height":720,"fps":30,"durationSeconds":5,"aspect":"16:9"}','30000000-0000-4000-8000-000000000001')->>'projectId')::uuid;
do $$declare id uuid;begin
 select project_id into id from motion_test_ids;
 if (public.create_motion_project('10000000-0000-4000-8000-000000000001','Study','Five seconds of shapes','manual','{"width":1280,"height":720,"fps":30,"durationSeconds":5,"aspect":"16:9"}','30000000-0000-4000-8000-000000000001')->>'projectId')::uuid<>id then raise exception 'Project replay duplicated';end if;
 begin perform public.create_motion_project('10000000-0000-4000-8000-000000000001','Changed','Five seconds of shapes','manual','{"width":1280,"height":720,"fps":30,"durationSeconds":5,"aspect":"16:9"}','30000000-0000-4000-8000-000000000001');raise exception 'Conflicting replay accepted';exception when raise_exception then if sqlerrm<>'idempotency_conflict' then raise;end if;end;
 begin perform public.create_motion_project('10000000-0000-4000-8000-000000000002','Cross','Five seconds','manual','{"width":1280,"height":720,"fps":30,"durationSeconds":5,"aspect":"16:9"}',gen_random_uuid());raise exception 'Cross workspace create accepted';exception when raise_exception then if sqlerrm<>'workspace_access_denied' then raise;end if;end;
 begin perform public.create_motion_project('10000000-0000-4000-8000-000000000001','Oversize','Five seconds','manual','{"width":1920,"height":1080,"fps":30,"durationSeconds":5,"aspect":"16:9"}',gen_random_uuid());raise exception 'Free 1080p accepted';exception when raise_exception then if sqlerrm<>'motion_spec_limit' then raise;end if;end;
 begin perform public.enqueue_motion_task(id,'motion_generate',gen_random_uuid());raise exception 'Disabled generation accepted';exception when raise_exception then if sqlerrm<>'motion_generation_unavailable' then raise;end if;end;
 if has_function_privilege('authenticated','public.save_motion_version(uuid,uuid,text,jsonb,uuid)','execute') then raise exception 'Browser can forge lint admission';end if;
 if has_function_privilege('authenticated','public.claim_motion_task(text,text[],integer)','execute') then raise exception 'Browser can lease queue';end if;
 if has_table_privilege('authenticated','public.motion_versions','insert') or has_table_privilege('authenticated','public.motion_projects','update') or has_table_privilege('authenticated','public.motion_prompts','update') then raise exception 'Browser mutation grant leaked';end if;
end $$;
reset role;
update motion_test_ids set version_id=(public.save_motion_version(project_id,'00000000-0000-4000-8000-000000000001','<html><body><script>window.DURATION=5;window.seek=async function(t){};</script></body></html>','{"ok":true,"errors":[],"warnings":[]}')->>'versionId')::uuid;
do $$begin begin update public.motion_versions set html_source='changed' where id=(select version_id from motion_test_ids);raise exception 'Immutable source edited';exception when raise_exception then if sqlerrm<>'motion_versions_are_immutable' then raise;end if;end;end $$;
update public.motion_runtime_config set render_enabled=true;
set local role authenticated;
update motion_test_ids set task_id=(public.enqueue_motion_task(project_id,'motion_render','30000000-0000-4000-8000-000000000002',version_id)->>'taskId')::uuid;
do $$declare t uuid;begin select task_id into t from motion_test_ids;
 if not exists(select 1 from public.motion_usage_periods where workspace_id='10000000-0000-4000-8000-000000000001' and seconds_reserved=5 and seconds_committed=0) then raise exception 'Reservation missing';end if;
 if (public.enqueue_motion_task((select project_id from motion_test_ids),'motion_render','30000000-0000-4000-8000-000000000002',(select version_id from motion_test_ids))->>'taskId')::uuid<>t then raise exception 'Task replay duplicated';end if;
 begin perform public.enqueue_motion_task((select project_id from motion_test_ids),'motion_render',gen_random_uuid(),(select version_id from motion_test_ids));raise exception 'Concurrency cap bypassed';exception when raise_exception then if sqlerrm<>'motion_concurrency_limit' then raise;end if;end;
end $$;
reset role;
do $$declare c jsonb;begin c:=public.claim_motion_task('test-controller',array['motion_render']);
 if c->>'task_type'<>'motion_render' or c->'plan'->>'motion_watermark_required'<>'true' then raise exception 'Claim missing canonical worker plan';end if;
 update motion_test_ids set lease_token=(c->>'lease_token')::uuid,render_id=(c->>'render_id')::uuid;
 if public.complete_motion_task((select task_id from motion_test_ids),gen_random_uuid(),'{}') then raise exception 'Stale worker committed';end if;
 if (public.heartbeat_motion_task((select task_id from motion_test_ids),(select lease_token from motion_test_ids),0.4)->>'cancelled')::boolean then raise exception 'Valid heartbeat cancelled';end if;
end $$;
do $$declare result jsonb;begin
 select jsonb_build_object('outputAssetPath','10000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001/'||project_id||'/motion_render/'||gen_random_uuid()||'.mp4','durationSeconds',5,'sizeBytes',1000,'watermarked',true,'manifest',jsonb_build_object('contract','vidrial-seek-v1','spec',(select render_spec from public.motion_projects where id=project_id),'sourceHash',(select content_hash from public.motion_versions where id=version_id),'frameCount',150,'watermarked',true)) into result from motion_test_ids;
 if not public.complete_motion_task((select task_id from motion_test_ids),(select lease_token from motion_test_ids),result) then raise exception 'Valid completion rejected';end if;
 if public.complete_motion_task((select task_id from motion_test_ids),(select lease_token from motion_test_ids),result) then raise exception 'Completed task recommitted';end if;
 if not exists(select 1 from public.motion_usage_periods where workspace_id='10000000-0000-4000-8000-000000000001' and seconds_reserved=0 and seconds_committed=5) then raise exception 'Exactly-once metering failed';end if;
end $$;
set local role authenticated;
update motion_test_ids set task_id=(public.enqueue_motion_task(project_id,'motion_render',gen_random_uuid(),version_id)->>'taskId')::uuid;
reset role;
update motion_test_ids set lease_token=(public.claim_motion_task('test-controller',array['motion_render'])->>'lease_token')::uuid;
set local role authenticated;
select public.cancel_motion_task(task_id) from motion_test_ids;
select public.cancel_motion_task(task_id) from motion_test_ids;
reset role;
do $$begin
 if public.complete_motion_task((select task_id from motion_test_ids),(select lease_token from motion_test_ids),'{}') then raise exception 'Cancellation fence failed';end if;
 if not exists(select 1 from public.motion_usage_periods where workspace_id='10000000-0000-4000-8000-000000000001' and seconds_reserved=0 and seconds_committed=5) then raise exception 'Cancellation released twice or refunded committed usage';end if;
end $$;
select public.record_motion_prompt_event('20000000-0000-4000-8000-000000000001','view',repeat('a',64));
select public.record_motion_prompt_event('20000000-0000-4000-8000-000000000001','view',repeat('a',64));
select public.record_motion_prompt_event('20000000-0000-4000-8000-000000000001','like',repeat('a',64),'00000000-0000-4000-8000-000000000001');
select public.record_motion_prompt_event('20000000-0000-4000-8000-000000000001','like',repeat('a',64),'00000000-0000-4000-8000-000000000001');
do $$begin if not exists(select 1 from public.motion_prompts where id='20000000-0000-4000-8000-000000000001' and view_count=1 and like_count=1) then raise exception 'Real counters not transactional/deduplicated';end if;end $$;
set local role anon;
do $$begin if (select count(*) from public.approved_motion_prompts)<>1 then raise exception 'Public view exposes pending rows';end if;if has_table_privilege('anon','public.motion_prompts','select') then raise exception 'Public table bypasses view';end if;end $$;
reset role;
-- Bounded crash retry and stale-lease fencing preserve the same reservation.
set local role authenticated;
update motion_test_ids set task_id=(public.enqueue_motion_task(project_id,'motion_render',gen_random_uuid(),version_id)->>'taskId')::uuid;
reset role;
update motion_test_ids set lease_token=(public.claim_motion_task('crash-worker',array['motion_render'])->>'lease_token')::uuid;
select public.fail_motion_task(task_id,lease_token,'browser_crash',true) from motion_test_ids;
update public.motion_tasks set available_at=now() where id=(select task_id from motion_test_ids);
update motion_test_ids set lease_token=(public.claim_motion_task('retry-worker',array['motion_render'])->>'lease_token')::uuid;
select public.fail_motion_task(task_id,lease_token,'browser_crash',true) from motion_test_ids;
do $$begin if not exists(select 1 from public.motion_tasks where id=(select task_id from motion_test_ids) and attempt=2 and status='failed') or not exists(select 1 from public.motion_usage_periods where workspace_id='10000000-0000-4000-8000-000000000001' and seconds_reserved=0 and seconds_committed=5) then raise exception 'Crash retry exceeded budget or leaked reservation';end if;end $$;
-- Community publishing requires a license grant and a verified render, then
-- remains private until the service-only moderation transaction approves assets.
set local role authenticated;
do $$begin begin perform public.publish_motion_prompt((select project_id from motion_test_ids),(select version_id from motion_test_ids),'Community','Original community text','showreel','{}',false);raise exception 'Missing license accepted';exception when raise_exception then if sqlerrm<>'license_grant_required' then raise;end if;end;end $$;
create temporary table motion_submission_test(id uuid);
insert into motion_submission_test select (public.publish_motion_prompt(project_id,version_id,'Community','Original community text','showreel','{}',true)->>'promptId')::uuid from motion_test_ids;
reset role;
do $$declare item uuid;preview text;poster text;begin
 select id into item from motion_submission_test;preview:='approved/'||item||'/'||gen_random_uuid()||'.mp4';poster:='approved/'||item||'/'||gen_random_uuid()||'.png';
 if exists(select 1 from public.approved_motion_prompts where id=item) then raise exception 'Pending submission public';end if;
 if not exists(select 1 from public.motion_prompt_submissions where prompt_id=item) then raise exception 'Moderation provenance missing';end if;
 begin perform public.approve_motion_prompt(item,preview,poster);raise exception 'Unuploaded gallery assets accepted';exception when raise_exception then if sqlerrm<>'gallery_assets_missing' then raise;end if;end;
 insert into storage.objects(bucket_id,name) values('motion-gallery',preview),('motion-gallery',poster);
 perform public.approve_motion_prompt(item,preview,poster);
 if not exists(select 1 from public.approved_motion_prompts where id=item and view_count=0 and like_count=0 and source='community') then raise exception 'Approved submission or real zero metrics missing';end if;
end $$;
-- Reference ingestion checks the existing immutable source path and explicit rights.
update public.motion_runtime_config set generation_enabled=true,reference_enabled=true,allowed_models=array['test/vision'];
update public.motion_projects set model_id='test/vision' where id=(select project_id from motion_test_ids);
insert into public.media_assets(id,workspace_id,user_id,source_type,display_name,mime_type,size_bytes,duration_seconds,status,storage_bucket,storage_path) values('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','local_upload','Reference','video/mp4',1000,5,'uploaded','source-media','10000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/source/40000000-0000-4000-8000-000000000001.mp4');
set local role authenticated;
do $$begin begin perform public.enqueue_motion_task((select project_id from motion_test_ids),'motion_analyze_reference',gen_random_uuid(),null,'{"mediaAssetId":"40000000-0000-4000-8000-000000000001","rightsAccepted":false}');raise exception 'Missing rights accepted';exception when raise_exception then if sqlerrm<>'rights_attestation_required' then raise;end if;end;end $$;
update motion_test_ids set task_id=(public.enqueue_motion_task(project_id,'motion_analyze_reference',gen_random_uuid(),null,'{"mediaAssetId":"40000000-0000-4000-8000-000000000001","rightsAccepted":true}')->>'taskId')::uuid;
reset role;
update motion_test_ids set lease_token=(public.claim_motion_task('reference-worker',array['motion_analyze_reference'])->>'lease_token')::uuid;
select public.fail_motion_task(task_id,lease_token,'reference_unreadable',false) from motion_test_ids;
set local role authenticated;
do $$begin begin perform public.enqueue_motion_task((select project_id from motion_test_ids),'motion_generate',gen_random_uuid());raise exception 'Failed latest reference ignored';exception when raise_exception then if sqlerrm<>'reference_analysis_not_ready' then raise;end if;end;end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.motion_projects where id=(select project_id from motion_test_ids)) or exists(select 1 from public.motion_versions where id=(select version_id from motion_test_ids)) or exists(select 1 from public.motion_renders where project_id=(select project_id from motion_test_ids)) or exists(select 1 from public.motion_tasks where project_id=(select project_id from motion_test_ids)) then raise exception 'Cross-workspace RLS leaked';end if;
 begin perform public.cancel_motion_task((select task_id from motion_test_ids));raise exception 'Cross-workspace cancellation allowed';exception when raise_exception then if sqlerrm<>'workspace_access_denied' then raise;end if;end;
 begin insert into storage.objects(bucket_id,name) values('motion-private','10000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000002/scene/render/file.mp4');raise exception 'General storage OR policy allowed motion writes';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
