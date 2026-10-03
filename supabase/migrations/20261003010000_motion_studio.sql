begin;

alter table public.plans add column monthly_motion_render_seconds bigint not null default 0 check(monthly_motion_render_seconds>=0), add column max_motion_seconds_per_video integer not null default 15, add column max_motion_width integer not null default 1280, add column max_motion_height integer not null default 720, add column max_motion_fps integer not null default 30, add column motion_watermark_required boolean not null default true;
update public.plans set monthly_motion_render_seconds=120,max_motion_seconds_per_video=15 where key='free';
update public.plans set monthly_motion_render_seconds=1800,max_motion_seconds_per_video=60,max_motion_width=1920,max_motion_height=1080,motion_watermark_required=false where key='creator';
update public.plans set monthly_motion_render_seconds=7200,max_motion_seconds_per_video=60,max_motion_width=1920,max_motion_height=1080,max_motion_fps=60,motion_watermark_required=false where key='pro';

-- Operators enable each lane only after verifying its deployment. Browser roles cannot change this row.
create table public.motion_runtime_config(singleton boolean primary key default true check(singleton),generation_enabled boolean not null default false,render_enabled boolean not null default false,reference_enabled boolean not null default false,allowed_models text[] not null default '{}');
insert into public.motion_runtime_config(singleton) values(true);
alter table public.motion_runtime_config enable row level security;
revoke all on public.motion_runtime_config from anon,authenticated;
grant all on public.motion_runtime_config to service_role;
create function public.motion_studio_capabilities() returns jsonb language sql stable security definer set search_path='' as $$ select jsonb_build_object('schemaVersion',1,'generationEnabled',generation_enabled,'renderEnabled',render_enabled,'referenceEnabled',reference_enabled,'models',to_jsonb(allowed_models)) from public.motion_runtime_config where singleton $$;

create table public.motion_prompts(
 id uuid primary key default gen_random_uuid(),slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),title text not null check(length(title) between 1 and 160),prompt text not null check(length(prompt) between 1 and 6000),
 category text not null check(category in('launch-film','product-demo','showreel','ad-edit','explainer','tutorial','kinetic-typography','logo-reveal','data-story','3d-loop')),tags text[] not null default '{}' check(cardinality(tags)<=12),aspect text not null check(aspect in('16:9','1:1','9:16')),duration_seconds numeric not null check(duration_seconds between 1 and 60),recommended_model text,
 source text not null check(source in('official','community')),author_user_id uuid references public.profiles(id) on delete set null,author_display_name text not null,license text not null check(license in('vidrial_original','user_granted')),status text not null default 'pending' check(status in('pending','approved','rejected')),
 preview_asset_path text,poster_path text,view_count bigint not null default 0 check(view_count>=0),like_count bigint not null default 0 check(like_count>=0),copy_count bigint not null default 0 check(copy_count>=0),use_count bigint not null default 0 check(use_count>=0),created_at timestamptz not null default now(),
 check((source='official' and license='vidrial_original') or (source='community' and license='user_granted')),
 check(preview_asset_path is null or preview_asset_path ~ '^approved/[a-zA-Z0-9/_-]+\.mp4$'), check(poster_path is null or poster_path ~ '^approved/[a-zA-Z0-9/_-]+\.(png|jpg|webp)$')
);
create index motion_prompts_browse on public.motion_prompts(status,category,created_at desc);
alter table public.motion_prompts enable row level security;
create policy motion_prompts_owner_read on public.motion_prompts for select to authenticated using(author_user_id=auth.uid());
revoke all on public.motion_prompts from anon,authenticated;
grant select on public.motion_prompts to authenticated;
create view public.approved_motion_prompts with(security_barrier=true) as select id,slug,title,prompt,category,tags,aspect,duration_seconds,recommended_model,source,author_display_name,license,status,preview_asset_path,poster_path,view_count,like_count,copy_count,use_count,created_at from public.motion_prompts where status='approved';
grant select on public.approved_motion_prompts to anon,authenticated;

create table public.motion_projects(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,user_id uuid not null references public.profiles(id),title text not null check(length(title) between 1 and 160),source_prompt_id uuid references public.motion_prompts(id),prompt_text text not null check(length(prompt_text) between 1 and 6000),model_id text not null,credential_ref uuid,
 render_spec jsonb not null,status text not null default 'draft' check(status in('draft','brief','generating','linting','repairing','preview_ready','rendering','ready','failed','cancelled')),idempotency_key uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(workspace_id,idempotency_key),unique(id,workspace_id)
);
create table public.motion_versions(
 id uuid primary key default gen_random_uuid(),project_id uuid not null,workspace_id uuid not null,html_source text not null check(octet_length(html_source)<=256000),content_hash text not null check(content_hash ~ '^[0-9a-f]{64}$'),critique_report jsonb not null default '{}'::jsonb,lint_report jsonb not null check(lint_report->>'ok'='true'),model_used text,tokens_used bigint not null default 0 check(tokens_used>=0),parent_version_id uuid,created_at timestamptz not null default now(),foreign key(project_id,workspace_id) references public.motion_projects(id,workspace_id) on delete cascade,unique(id,project_id),unique(project_id,content_hash),foreign key(parent_version_id,project_id) references public.motion_versions(id,project_id)
);
create table public.motion_renders(
 id uuid primary key default gen_random_uuid(),project_id uuid not null,workspace_id uuid not null,version_id uuid not null,render_spec jsonb not null,render_manifest jsonb,job_task_id uuid,status text not null default 'queued' check(status in('queued','running','ready','failed','cancelled')),progress numeric not null default 0 check(progress between 0 and 1),output_asset_path text,duration_seconds numeric,size_bytes bigint,error_code text,watermarked boolean not null,created_at timestamptz not null default now(),completed_at timestamptz,foreign key(project_id,workspace_id) references public.motion_projects(id,workspace_id) on delete cascade,foreign key(version_id,project_id) references public.motion_versions(id,project_id),unique(id,project_id),check(size_bytes is null or size_bytes between 1 and 134217728)
);
create table public.motion_reference_analyses(
 id uuid primary key default gen_random_uuid(),project_id uuid not null,workspace_id uuid not null,media_asset_id uuid not null references public.media_assets(id),brief_json jsonb,model_used text,status text not null default 'queued' check(status in('queued','running','ready','failed','cancelled')),error_code text,rights_accepted_at timestamptz not null,rights_user_id uuid not null references public.profiles(id),created_at timestamptz not null default now(),foreign key(project_id,workspace_id) references public.motion_projects(id,workspace_id) on delete cascade,unique(id,project_id)
);
create table public.motion_usage_periods(
 workspace_id uuid not null references public.workspaces(id) on delete cascade,period_start timestamptz not null,seconds_reserved bigint not null default 0 check(seconds_reserved>=0),seconds_committed bigint not null default 0 check(seconds_committed>=0),primary key(workspace_id,period_start)
);
create table public.motion_tasks(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,project_id uuid not null,user_id uuid not null references public.profiles(id),task_type text not null check(task_type in('motion_generate','motion_render','motion_analyze_reference')),version_id uuid,render_id uuid,reference_id uuid,payload_json jsonb not null default '{}',status text not null default 'queued' check(status in('queued','running','completed','failed','cancelled')),attempt integer not null default 0,max_attempts integer not null default 2 check(max_attempts between 1 and 2),lease_token uuid,leased_until timestamptz,worker_id text,progress numeric not null default 0 check(progress between 0 and 1),reserved_seconds bigint not null default 0 check(reserved_seconds>=0),usage_period_start timestamptz not null default date_trunc('month',now()),idempotency_key uuid not null,error_code text,available_at timestamptz not null default now(),created_at timestamptz not null default now(),completed_at timestamptz,
 foreign key(project_id,workspace_id) references public.motion_projects(id,workspace_id) on delete cascade,foreign key(version_id,project_id) references public.motion_versions(id,project_id),foreign key(render_id,project_id) references public.motion_renders(id,project_id),foreign key(reference_id,project_id) references public.motion_reference_analyses(id,project_id),unique(workspace_id,idempotency_key)
);
alter table public.motion_renders add foreign key(job_task_id) references public.motion_tasks(id);
create index motion_tasks_claim on public.motion_tasks(status,task_type,available_at,created_at);
create index motion_tasks_project on public.motion_tasks(project_id,created_at desc);
create index motion_projects_workspace on public.motion_projects(workspace_id,created_at desc);
-- Private provenance survives moderation without exposing project IDs publicly.
create table public.motion_prompt_submissions(prompt_id uuid primary key references public.motion_prompts(id) on delete cascade,project_id uuid not null,workspace_id uuid not null,version_id uuid not null,render_id uuid not null,license_version text not null default 'motion-gallery-license-v1',foreign key(project_id,workspace_id) references public.motion_projects(id,workspace_id),foreign key(version_id,project_id) references public.motion_versions(id,project_id),foreign key(render_id,project_id) references public.motion_renders(id,project_id));
create table public.motion_prompt_likes(prompt_id uuid not null references public.motion_prompts(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now(),primary key(prompt_id,user_id));
create table public.motion_prompt_events(prompt_id uuid not null references public.motion_prompts(id) on delete cascade,event text not null check(event in('view','copy','use')),session_hash text not null,event_day date not null default current_date,created_at timestamptz not null default now(),primary key(prompt_id,event,session_hash,event_day));
create table public.motion_prompt_reports(id uuid primary key default gen_random_uuid(),prompt_id uuid not null references public.motion_prompts(id) on delete cascade,user_id uuid not null references public.profiles(id),reason text not null check(length(reason) between 3 and 2000),created_at timestamptz not null default now(),unique(prompt_id,user_id));

do $$ declare t text;begin
 foreach t in array array['motion_projects','motion_versions','motion_renders','motion_reference_analyses','motion_usage_periods','motion_tasks','motion_prompt_submissions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy %I on public.%I for select to authenticated using(public.is_workspace_member(workspace_id))',t||'_read',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['motion_prompt_likes','motion_prompt_events','motion_prompt_reports'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);end loop;
end $$;
create policy motion_likes_read on public.motion_prompt_likes for select to authenticated using(user_id=auth.uid());
create policy motion_reports_read on public.motion_prompt_reports for select to authenticated using(user_id=auth.uid());
grant select on public.motion_prompt_likes,public.motion_prompt_reports to authenticated;
grant all on public.motion_projects,public.motion_versions,public.motion_renders,public.motion_reference_analyses,public.motion_usage_periods,public.motion_tasks,public.motion_prompt_submissions,public.motion_prompts,public.motion_prompt_events,public.motion_prompt_reports,public.motion_prompt_likes to service_role;

create function public.motion_assert_editor(p_workspace_id uuid) returns void language plpgsql stable security definer set search_path='' as $$
begin if auth.uid() is null or not exists(select 1 from public.workspaces w where w.id=p_workspace_id and (w.owner_id=auth.uid() or exists(select 1 from public.workspace_members m where m.workspace_id=w.id and m.user_id=auth.uid() and m.role in('owner','admin','editor')))) then raise exception 'workspace_access_denied';end if;end $$;
create function public.motion_validate_spec(p_spec jsonb,p_plan public.plans) returns void language plpgsql immutable set search_path='' as $$
declare w integer;h integer;f integer;d numeric;a text;ratio numeric;
begin w:=(p_spec->>'width')::integer;h:=(p_spec->>'height')::integer;f:=(p_spec->>'fps')::integer;d:=(p_spec->>'durationSeconds')::numeric;a:=p_spec->>'aspect';ratio:=case a when '16:9' then 16.0/9 when '1:1' then 1 when '9:16' then 9.0/16 end;
 if jsonb_typeof(p_spec)<>'object' or p_spec->>'durationSeconds' in('NaN','Infinity','-Infinity') then raise exception 'invalid_motion_spec';end if;
 if w is null or h is null or f is null or d is null or ratio is null or w<64 or h<64 or w%2<>0 or h%2<>0 or f not in(24,30,60) or d<1 or d>p_plan.max_motion_seconds_per_video or greatest(w,h)>greatest(p_plan.max_motion_width,p_plan.max_motion_height) or least(w,h)>least(p_plan.max_motion_width,p_plan.max_motion_height) or f>p_plan.max_motion_fps or abs(w::numeric/h-ratio)>0.005 or w::bigint*h>3686400 or ceil(d*f)>3600 then raise exception 'motion_spec_limit';end if;
end $$;
create function public.get_motion_usage(p_workspace_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare pl public.plans;u public.motion_usage_periods;begin
 if not public.is_workspace_member(p_workspace_id) then raise exception 'workspace_access_denied';end if;
 select p.* into pl from public.plans p join public.profiles profile on profile.plan_key=p.key join public.workspaces w on w.owner_id=profile.id where w.id=p_workspace_id;
 select * into u from public.motion_usage_periods where workspace_id=p_workspace_id and period_start=date_trunc('month',now());
 return jsonb_build_object('plan',pl.key,'limitSeconds',pl.monthly_motion_render_seconds,'reservedSeconds',coalesce(u.seconds_reserved,0),'committedSeconds',coalesce(u.seconds_committed,0));
end $$;
create function public.motion_version_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'motion_versions_are_immutable';end $$;
create trigger immutable_motion_versions before update on public.motion_versions for each row execute function public.motion_version_immutable();
create function public.motion_render_immutable() returns trigger language plpgsql set search_path='' as $$begin if old.status='ready' and new is distinct from old then raise exception 'completed_motion_renders_are_immutable';end if;return new;end $$;
create trigger immutable_ready_motion_renders before update on public.motion_renders for each row execute function public.motion_render_immutable();

create function public.create_motion_project(p_workspace_id uuid,p_title text,p_prompt text,p_model_id text,p_render_spec jsonb,p_idempotency_key uuid,p_source_prompt_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare pr public.motion_projects;pl public.plans;begin
 perform public.motion_assert_editor(p_workspace_id);perform 1 from public.workspaces where id=p_workspace_id for update;
 select p.* into pl from public.plans p join public.profiles u on u.plan_key=p.key join public.workspaces w on w.owner_id=u.id where w.id=p_workspace_id;
 perform public.motion_validate_spec(p_render_spec,pl);
 select * into pr from public.motion_projects where workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then if pr.user_id<>auth.uid() or pr.title<>p_title or pr.prompt_text<>p_prompt or pr.model_id<>p_model_id or pr.render_spec<>p_render_spec or pr.source_prompt_id is distinct from p_source_prompt_id then raise exception 'idempotency_conflict';end if;return jsonb_build_object('projectId',pr.id);end if;
 if p_source_prompt_id is not null and not exists(select 1 from public.motion_prompts where id=p_source_prompt_id and status='approved') then raise exception 'prompt_unavailable';end if;
 if p_model_id<>'manual' and not exists(select 1 from public.motion_runtime_config where p_model_id=any(allowed_models)) then raise exception 'model_unavailable';end if;
 if (select count(*) from public.motion_projects where workspace_id=p_workspace_id and created_at>now()-interval '1 day')>=100 then raise exception 'motion_project_rate_limit';end if;
 insert into public.motion_projects(workspace_id,user_id,title,source_prompt_id,prompt_text,model_id,render_spec,idempotency_key) values(p_workspace_id,auth.uid(),p_title,p_source_prompt_id,p_prompt,p_model_id,p_render_spec,p_idempotency_key) returning * into pr;
 return jsonb_build_object('projectId',pr.id);
end $$;

-- Source edits are admitted by the trusted web service's linter, never a browser-supplied report.
create function public.save_motion_version(p_project_id uuid,p_user_id uuid,p_html_source text,p_lint_report jsonb,p_parent_version_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare pr public.motion_projects;v uuid;hash text;begin
 select * into pr from public.motion_projects where id=p_project_id for update;
 if not found or not exists(select 1 from public.workspaces w where w.id=pr.workspace_id and (w.owner_id=p_user_id or exists(select 1 from public.workspace_members m where m.workspace_id=w.id and m.user_id=p_user_id and m.role in('owner','admin','editor')))) then raise exception 'workspace_access_denied';end if;
 if exists(select 1 from public.motion_tasks where project_id=pr.id and status in('queued','running')) then raise exception 'project_busy';end if;
 if p_lint_report->>'ok' is distinct from 'true' then raise exception 'motion_lint_failed';end if;
 hash:=encode(extensions.digest(p_html_source,'sha256'),'hex');
 insert into public.motion_versions(project_id,workspace_id,html_source,content_hash,lint_report,parent_version_id) values(pr.id,pr.workspace_id,p_html_source,hash,p_lint_report,p_parent_version_id) on conflict(project_id,content_hash) do nothing returning id into v;
 if v is null then select id into v from public.motion_versions where project_id=pr.id and content_hash=hash;end if;
 update public.motion_projects set status='preview_ready',updated_at=now() where id=pr.id;
 return jsonb_build_object('versionId',v);
end $$;

create function public.enqueue_motion_task(p_project_id uuid,p_type text,p_idempotency_key uuid,p_version_id uuid default null,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare pr public.motion_projects;pl public.plans;t public.motion_tasks;cfg public.motion_runtime_config;r uuid;ref uuid;sec bigint:=0;period timestamptz:=date_trunc('month',now());used bigint;asset public.media_assets;
begin
 select * into pr from public.motion_projects where id=p_project_id;if not found then raise exception 'project_not_found';end if;
 perform public.motion_assert_editor(pr.workspace_id);perform 1 from public.workspaces where id=pr.workspace_id for update;
 select * into t from public.motion_tasks where workspace_id=pr.workspace_id and idempotency_key=p_idempotency_key;
 if found then if t.project_id<>p_project_id or t.user_id<>auth.uid() or t.task_type<>p_type or t.version_id is distinct from p_version_id or t.payload_json<>p_payload then raise exception 'idempotency_conflict';end if;return jsonb_build_object('taskId',t.id,'renderId',t.render_id,'referenceId',t.reference_id);end if;
 select p.* into pl from public.plans p join public.profiles u on u.plan_key=p.key join public.workspaces w on w.owner_id=u.id where w.id=pr.workspace_id;perform public.motion_validate_spec(pr.render_spec,pl);select * into cfg from public.motion_runtime_config where singleton;
 if (select count(*) from public.motion_tasks where workspace_id=pr.workspace_id and status in('queued','running'))>=pl.max_concurrent_jobs then raise exception 'motion_concurrency_limit';end if;
 if exists(select 1 from public.motion_tasks where project_id=pr.id and status in('queued','running')) then raise exception 'project_busy';end if;
 if (select count(*) from public.motion_tasks where user_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'motion_rate_limit';end if;
 if p_type='motion_generate' then
  if jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in('instruction','parentVersionId')) then raise exception 'invalid_task_payload';end if;
  if not cfg.generation_enabled or not pr.model_id=any(cfg.allowed_models) then raise exception 'motion_generation_unavailable';end if;
  if length(coalesce(p_payload->>'instruction',''))>4000 then raise exception 'instruction_too_long';end if;
  if exists(select 1 from public.motion_reference_analyses where id=(select id from public.motion_reference_analyses where project_id=pr.id order by created_at desc,id desc limit 1) and (status<>'ready' or brief_json is null)) then raise exception 'reference_analysis_not_ready';end if;
  if p_payload->>'parentVersionId' is not null and not exists(select 1 from public.motion_versions where id=(p_payload->>'parentVersionId')::uuid and project_id=pr.id) then raise exception 'version_access_denied';end if;
 elsif p_type='motion_render' then
  if p_payload<>'{}'::jsonb then raise exception 'invalid_task_payload';end if;
  if not cfg.render_enabled then raise exception 'motion_render_unavailable';end if;
  if not exists(select 1 from public.motion_versions where id=p_version_id and project_id=pr.id and lint_report->>'ok'='true') then raise exception 'version_access_denied';end if;
  sec:=ceil((pr.render_spec->>'durationSeconds')::numeric);insert into public.motion_usage_periods(workspace_id,period_start) values(pr.workspace_id,period) on conflict do nothing;
  select seconds_reserved+seconds_committed into used from public.motion_usage_periods where workspace_id=pr.workspace_id and period_start=period for update;
  if used+sec>pl.monthly_motion_render_seconds then raise exception 'motion_usage_limit';end if;
  update public.motion_usage_periods set seconds_reserved=seconds_reserved+sec where workspace_id=pr.workspace_id and period_start=period;
  insert into public.motion_renders(project_id,workspace_id,version_id,render_spec,watermarked) values(pr.id,pr.workspace_id,p_version_id,pr.render_spec,pl.motion_watermark_required) returning id into r;
 elsif p_type='motion_analyze_reference' then
  if jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in('mediaAssetId','rightsAccepted')) then raise exception 'invalid_task_payload';end if;
  if not cfg.reference_enabled or not pr.model_id=any(cfg.allowed_models) then raise exception 'motion_reference_unavailable';end if;
  if p_payload->>'rightsAccepted' is distinct from 'true' then raise exception 'rights_attestation_required';end if;
  select * into asset from public.media_assets where id=(p_payload->>'mediaAssetId')::uuid and workspace_id=pr.workspace_id and deleted_at is null and status in('ready','uploaded') and mime_type in('video/mp4','video/webm','video/quicktime') and storage_path is not null and storage_bucket='source-media' and size_bytes between 1 and 52428800 and duration_seconds between 1 and 60;
  if not found then raise exception 'reference_asset_unavailable';end if;
  if asset.storage_path !~ ('^'||asset.workspace_id||'/'||asset.user_id||'/[0-9a-f-]{36}/source/'||asset.id||'\.(mp4|mov|webm)$') then raise exception 'reference_asset_path_invalid';end if;
  insert into public.motion_reference_analyses(project_id,workspace_id,media_asset_id,rights_accepted_at,rights_user_id) values(pr.id,pr.workspace_id,asset.id,now(),auth.uid()) returning id into ref;
 else raise exception 'invalid_motion_task';end if;
 insert into public.motion_tasks(workspace_id,project_id,user_id,task_type,version_id,render_id,reference_id,payload_json,reserved_seconds,usage_period_start,idempotency_key) values(pr.workspace_id,pr.id,auth.uid(),p_type,p_version_id,r,ref,p_payload,sec,period,p_idempotency_key) returning * into t;
 if r is not null then update public.motion_renders set job_task_id=t.id where id=r;end if;
 update public.motion_projects set status=case p_type when 'motion_generate' then 'generating' when 'motion_render' then 'rendering' else 'brief' end,updated_at=now() where id=pr.id;
 return jsonb_build_object('taskId',t.id,'renderId',r,'referenceId',ref);
end $$;

create function public.cancel_motion_task(p_task_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.motion_tasks;ws uuid;begin
 select workspace_id into ws from public.motion_tasks where id=p_task_id;perform public.motion_assert_editor(ws);perform 1 from public.workspaces where id=ws for update;
 select * into t from public.motion_tasks where id=p_task_id for update;
 if t.status in('completed','failed','cancelled') then return jsonb_build_object('cancelled',t.status='cancelled');end if;
 update public.motion_tasks set status='cancelled',lease_token=null,leased_until=null,completed_at=now() where id=t.id;
 update public.motion_usage_periods set seconds_reserved=seconds_reserved-t.reserved_seconds where workspace_id=t.workspace_id and period_start=t.usage_period_start;
 update public.motion_renders set status='cancelled',completed_at=now() where id=t.render_id;
 update public.motion_reference_analyses set status='cancelled' where id=t.reference_id;
 update public.motion_projects set status='cancelled',updated_at=now() where id=t.project_id;
 return jsonb_build_object('cancelled',true);
end $$;

-- Controller only. Lease tokens fence stale processes and cancelled writes.
create function public.claim_motion_task(p_worker_id text,p_include_types text[],p_lease_seconds integer default 90) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.motion_tasks;pr public.motion_projects;pl public.plans;ws uuid;begin
 if length(p_worker_id) not between 1 and 200 or p_lease_seconds not between 10 and 300 then raise exception 'invalid_lease';end if;
 -- Exhausted crashed tasks release reservations exactly once under the workspace lock.
 for ws in select distinct workspace_id from public.motion_tasks where status='running' and leased_until<now() and attempt>=max_attempts order by workspace_id loop
  perform 1 from public.workspaces where id=ws for update;
  for t in select * from public.motion_tasks where workspace_id=ws and status='running' and leased_until<now() and attempt>=max_attempts for update loop
   update public.motion_tasks set status='failed',error_code='lease_exhausted',lease_token=null,completed_at=now() where id=t.id;
   update public.motion_usage_periods set seconds_reserved=seconds_reserved-t.reserved_seconds where workspace_id=t.workspace_id and period_start=t.usage_period_start;
   update public.motion_renders set status='failed',error_code='lease_exhausted',completed_at=now() where id=t.render_id;
   update public.motion_reference_analyses set status='failed',error_code='lease_exhausted' where id=t.reference_id;
   update public.motion_projects set status='failed',updated_at=now() where id=t.project_id;
  end loop;
 end loop;
 select * into t from public.motion_tasks where task_type=any(p_include_types) and attempt<max_attempts and available_at<=now() and (status='queued' or (status='running' and leased_until<now())) order by created_at for update skip locked limit 1;
 if not found then return null;end if;
 update public.motion_tasks set status='running',attempt=attempt+1,lease_token=gen_random_uuid(),leased_until=now()+make_interval(secs=>p_lease_seconds),worker_id=p_worker_id where id=t.id returning * into t;
 select * into pr from public.motion_projects where id=t.project_id;
 select p.* into pl from public.plans p join public.profiles u on u.plan_key=p.key join public.workspaces w on w.owner_id=u.id where w.id=t.workspace_id;
 update public.motion_renders set status='running' where id=t.render_id;update public.motion_reference_analyses set status='running' where id=t.reference_id;
 return to_jsonb(t)||jsonb_build_object('project',to_jsonb(pr),'plan',to_jsonb(pl),'version',(select to_jsonb(v) from public.motion_versions v where v.id=t.version_id),'parent_version',(select to_jsonb(v) from public.motion_versions v where v.id=(t.payload_json->>'parentVersionId')::uuid),'render',(select to_jsonb(r) from public.motion_renders r where r.id=t.render_id),'reference',(select to_jsonb(a)||jsonb_build_object('asset',to_jsonb(m)) from public.motion_reference_analyses a join public.media_assets m on m.id=a.media_asset_id where a.id=t.reference_id),'reference_brief',(select brief_json from public.motion_reference_analyses where project_id=t.project_id and status='ready' order by created_at desc limit 1));
end $$;
create function public.heartbeat_motion_task(p_task_id uuid,p_lease_token uuid,p_progress numeric default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.motion_tasks;begin
 update public.motion_tasks set leased_until=now()+interval '90 seconds',progress=greatest(progress,least(1,greatest(0,p_progress))) where id=p_task_id and status='running' and lease_token=p_lease_token and leased_until>now() returning * into t;
 if not found then return jsonb_build_object('cancelled',true);end if;
 update public.motion_renders set progress=t.progress where id=t.render_id;
 return jsonb_build_object('cancelled',false);
end $$;
create function public.update_motion_task_stage(p_task_id uuid,p_lease_token uuid,p_stage text) returns boolean language plpgsql security definer set search_path='' as $$
declare t public.motion_tasks;begin
 if p_stage not in('brief','generating','linting','repairing') then raise exception 'invalid_motion_stage';end if;
 select * into t from public.motion_tasks where id=p_task_id and task_type='motion_generate' and status='running' and lease_token=p_lease_token and leased_until>now() for update;
 if not found then return false;end if;
 update public.motion_projects set status=p_stage,updated_at=now() where id=t.project_id;return true;
end $$;
create function public.complete_motion_task(p_task_id uuid,p_lease_token uuid,p_result jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare t public.motion_tasks;ws uuid;pr public.motion_projects;v uuid;hash text;pl public.plans;outpath text;begin
 select workspace_id into ws from public.motion_tasks where id=p_task_id;perform 1 from public.workspaces where id=ws for update;
 select * into t from public.motion_tasks where id=p_task_id for update;
 if not found or t.status<>'running' or t.lease_token is distinct from p_lease_token or t.leased_until<=now() then return false;end if;
 select * into pr from public.motion_projects where id=t.project_id;
 if t.task_type='motion_generate' then
  if p_result->'lintReport'->>'ok' is distinct from 'true' or p_result->>'htmlSource' is null then raise exception 'motion_lint_failed';end if;
  hash:=encode(extensions.digest(p_result->>'htmlSource','sha256'),'hex');
  insert into public.motion_versions(project_id,workspace_id,html_source,content_hash,lint_report,critique_report,model_used,tokens_used,parent_version_id) values(pr.id,pr.workspace_id,p_result->>'htmlSource',hash,p_result->'lintReport',coalesce(p_result->'critiqueReport','{}'::jsonb),p_result->>'modelUsed',coalesce((p_result->>'tokensUsed')::bigint,0),(t.payload_json->>'parentVersionId')::uuid) on conflict(project_id,content_hash) do nothing returning id into v;
  update public.motion_projects set status='preview_ready',updated_at=now() where id=pr.id;
 elsif t.task_type='motion_render' then
  select p.* into pl from public.plans p join public.profiles u on u.plan_key=p.key join public.workspaces w on w.owner_id=u.id where w.id=t.workspace_id;
  outpath:=p_result->>'outputAssetPath';
  if outpath is null or p_result->>'durationSeconds' is null or p_result->>'sizeBytes' is null or p_result->>'durationSeconds' in('NaN','Infinity','-Infinity') or outpath!~('^'||pr.workspace_id||'/'||pr.user_id||'/'||pr.id||'/motion_render/[0-9a-f-]{36}\.mp4$') or (p_result->>'watermarked')::boolean is distinct from (select watermarked from public.motion_renders where id=t.render_id) or abs((p_result->>'durationSeconds')::numeric-(pr.render_spec->>'durationSeconds')::numeric)>0.15 or (p_result->>'sizeBytes')::bigint not between 1 and 134217728 then raise exception 'invalid_motion_output';end if;
  if jsonb_typeof(p_result->'manifest') is distinct from 'object' or p_result->'manifest'->>'contract' is distinct from 'vidrial-seek-v1' or p_result->'manifest'->'spec' is distinct from pr.render_spec or p_result->'manifest'->>'sourceHash' is distinct from (select content_hash from public.motion_versions where id=t.version_id) or (p_result->'manifest'->>'frameCount')::integer is distinct from ceil((pr.render_spec->>'durationSeconds')::numeric*(pr.render_spec->>'fps')::integer)::integer or (p_result->'manifest'->>'watermarked')::boolean is distinct from (p_result->>'watermarked')::boolean then raise exception 'invalid_render_manifest';end if;
  update public.motion_renders set status='ready',progress=1,output_asset_path=outpath,render_manifest=p_result->'manifest',duration_seconds=(p_result->>'durationSeconds')::numeric,size_bytes=(p_result->>'sizeBytes')::bigint,completed_at=now() where id=t.render_id;
  update public.motion_usage_periods set seconds_reserved=seconds_reserved-t.reserved_seconds,seconds_committed=seconds_committed+t.reserved_seconds where workspace_id=t.workspace_id and period_start=t.usage_period_start;
  update public.motion_projects set status='ready',updated_at=now() where id=pr.id;
 else
  if jsonb_typeof(p_result->'brief')<>'object' then raise exception 'invalid_reference_brief';end if;
  update public.motion_reference_analyses set status='ready',brief_json=p_result->'brief',model_used=p_result->>'modelUsed' where id=t.reference_id;
  update public.motion_projects set status='draft',updated_at=now() where id=pr.id;
 end if;
 update public.motion_tasks set status='completed',progress=1,completed_at=now(),lease_token=null,leased_until=null where id=t.id;
 return true;
end $$;
create function public.fail_motion_task(p_task_id uuid,p_lease_token uuid,p_error_code text,p_retryable boolean default false) returns boolean language plpgsql security definer set search_path='' as $$
declare t public.motion_tasks;ws uuid;retry boolean;begin
 select workspace_id into ws from public.motion_tasks where id=p_task_id;perform 1 from public.workspaces where id=ws for update;select * into t from public.motion_tasks where id=p_task_id for update;
 if not found or t.status<>'running' or t.lease_token is distinct from p_lease_token or t.leased_until<=now() then return false;end if;
 if p_error_code !~ '^[a-z0-9_]{1,100}$' then raise exception 'invalid_error_code';end if;
 retry:=p_retryable and t.attempt<t.max_attempts;
 update public.motion_tasks set status=case when retry then 'queued' else 'failed' end,error_code=p_error_code,lease_token=null,leased_until=null,available_at=now()+interval '5 seconds',completed_at=case when retry then null else now() end where id=t.id;
 update public.motion_renders set status=case when retry then 'queued' else 'failed' end,error_code=p_error_code where id=t.render_id;update public.motion_reference_analyses set status=case when retry then 'queued' else 'failed' end,error_code=p_error_code where id=t.reference_id;
 if not retry then
  update public.motion_usage_periods set seconds_reserved=seconds_reserved-t.reserved_seconds where workspace_id=t.workspace_id and period_start=t.usage_period_start;
  update public.motion_projects set status='failed',updated_at=now() where id=t.project_id;
 end if;return true;
end $$;

create function public.record_motion_prompt_event(p_prompt_id uuid,p_event text,p_session_hash text,p_user_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare added integer;begin
 perform 1 from public.motion_prompts where id=p_prompt_id and status='approved' for update;if not found then raise exception 'prompt_unavailable';end if;
 if p_event='like' then
  if p_user_id is null then raise exception 'authentication_required';end if;
  insert into public.motion_prompt_likes(prompt_id,user_id) values(p_prompt_id,p_user_id) on conflict do nothing;get diagnostics added=row_count;
  if added>0 then update public.motion_prompts set like_count=like_count+1 where id=p_prompt_id;end if;
 elsif p_event in('view','copy','use') then
  if p_session_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_session';end if;
  insert into public.motion_prompt_events(prompt_id,event,session_hash,event_day) values(p_prompt_id,p_event,p_session_hash,case when p_event='view' then date '1970-01-01' else current_date end) on conflict do nothing;get diagnostics added=row_count;
  if added>0 then update public.motion_prompts set view_count=view_count+case when p_event='view' then 1 else 0 end,copy_count=copy_count+case when p_event='copy' then 1 else 0 end,use_count=use_count+case when p_event='use' then 1 else 0 end where id=p_prompt_id;end if;
 else raise exception 'invalid_event';end if;return jsonb_build_object('ok',true);
end $$;
create function public.publish_motion_prompt(p_project_id uuid,p_version_id uuid,p_title text,p_prompt text,p_category text,p_tags text[],p_license_granted boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare pr public.motion_projects;v uuid;begin
 select * into pr from public.motion_projects where id=p_project_id;perform public.motion_assert_editor(pr.workspace_id);
 if p_license_granted is distinct from true then raise exception 'license_grant_required';end if;
 if not exists(select 1 from public.motion_versions where id=p_version_id and project_id=pr.id) then raise exception 'version_access_denied';end if;
 if not exists(select 1 from public.motion_renders where project_id=pr.id and version_id=p_version_id and status='ready') then raise exception 'verified_render_required';end if;
 if (select count(*) from public.motion_prompts where author_user_id=auth.uid() and created_at>now()-interval '1 day')>=10 then raise exception 'submission_rate_limit';end if;
 v:=gen_random_uuid();insert into public.motion_prompts(id,slug,title,prompt,category,tags,aspect,duration_seconds,recommended_model,source,author_user_id,author_display_name,license,status) values(v,'community-'||v,p_title,p_prompt,p_category,p_tags,pr.render_spec->>'aspect',(pr.render_spec->>'durationSeconds')::numeric,nullif(pr.model_id,'manual'),'community',auth.uid(),coalesce((select display_name from public.profiles where id=auth.uid()),'Community creator'),'user_granted','pending');
 insert into public.motion_prompt_submissions(prompt_id,project_id,workspace_id,version_id,render_id) select v,pr.id,pr.workspace_id,p_version_id,id from public.motion_renders where project_id=pr.id and version_id=p_version_id and status='ready' order by completed_at desc limit 1;
 return jsonb_build_object('promptId',v,'status','pending');
end $$;
create function public.report_motion_prompt(p_prompt_id uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception 'authentication_required';end if;
 if not exists(select 1 from public.motion_prompts where id=p_prompt_id and status='approved') then raise exception 'prompt_unavailable';end if;
 insert into public.motion_prompt_reports(prompt_id,user_id,reason) values(p_prompt_id,auth.uid(),p_reason) on conflict(prompt_id,user_id) do nothing;return jsonb_build_object('reported',true);
end $$;
-- Admin must upload inspected immutable gallery assets before approving. Storage
-- object existence and provenance are checked in the same moderation transaction.
create function public.approve_motion_prompt(p_prompt_id uuid,p_preview_path text,p_poster_path text) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.motion_prompts;begin
 select * into item from public.motion_prompts where id=p_prompt_id for update;
 if not found or item.status='rejected' then raise exception 'prompt_unavailable';end if;
 if p_preview_path is null or p_poster_path is null or p_preview_path !~ ('^approved/'||p_prompt_id||'/[0-9a-f-]{36}\.mp4$') or p_poster_path !~ ('^approved/'||p_prompt_id||'/[0-9a-f-]{36}\.(png|jpg|webp)$') then raise exception 'invalid_gallery_path';end if;
 if item.source='community' and not exists(select 1 from public.motion_prompt_submissions s join public.motion_renders r on r.id=s.render_id where s.prompt_id=item.id and r.status='ready' and r.output_asset_path is not null and s.license_version='motion-gallery-license-v1') then raise exception 'verified_submission_required';end if;
 if not exists(select 1 from storage.objects where bucket_id='motion-gallery' and name=p_preview_path) or not exists(select 1 from storage.objects where bucket_id='motion-gallery' and name=p_poster_path) then raise exception 'gallery_assets_missing';end if;
 if item.status='approved' and (item.preview_asset_path is distinct from p_preview_path or item.poster_path is distinct from p_poster_path) then raise exception 'approved_assets_are_immutable';end if;
 update public.motion_prompts set status='approved',preview_asset_path=p_preview_path,poster_path=p_poster_path where id=item.id;
 return jsonb_build_object('promptId',item.id,'status','approved');
end $$;

-- PostgreSQL grants PUBLIC execution by default: revoke explicitly before assigning each trust boundary.
do $$ declare f record;begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like '%motion%' or p.proname='motion_assert_editor') loop execute 'revoke all on function '||f.signature||' from public,anon,authenticated';execute 'grant execute on function '||f.signature||' to service_role';end loop;end $$;
grant execute on function public.motion_studio_capabilities() to anon,authenticated;
grant execute on function public.create_motion_project(uuid,text,text,text,jsonb,uuid,uuid),public.enqueue_motion_task(uuid,text,uuid,uuid,jsonb),public.cancel_motion_task(uuid),public.publish_motion_prompt(uuid,uuid,text,text,text,text[],boolean),public.report_motion_prompt(uuid,text),public.get_motion_usage(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('motion-private','motion-private',false,134217728,array['video/mp4','text/html','image/png','image/jpeg']),('motion-gallery','motion-gallery',true,134217728,array['video/mp4','image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy motion_private_read on storage.objects for select to authenticated using(bucket_id='motion-private' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' then public.is_workspace_member(((storage.foldername(name))[1])::uuid) else false end);
-- Existing general storage policies are permissive. These restrictive policies
-- close their OR-policy loophole for BOTH motion buckets.
create policy motion_no_browser_insert on storage.objects as restrictive for insert to authenticated with check(bucket_id not in('motion-private','motion-gallery'));
create policy motion_no_browser_update on storage.objects as restrictive for update to authenticated using(bucket_id not in('motion-private','motion-gallery')) with check(bucket_id not in('motion-private','motion-gallery'));
create policy motion_no_browser_delete on storage.objects as restrictive for delete to authenticated using(bucket_id not in('motion-private','motion-gallery'));
-- Only service-role publishes gallery assets after moderation. No browser bucket write policy.
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.motion_projects,public.motion_renders;end if;end $$;
commit;
