begin;

-- Duration already paid for by this clip. Only trusted database functions and
-- workers may mutate it; shortening/restoring never refunds or charges twice.
create table public.clip_processing_allowances (
  clip_id uuid primary key references public.clips(id) on delete cascade,
  clip_job_id uuid not null references public.clip_jobs(id) on delete cascade,
  duration_seconds numeric not null check(duration_seconds>0 and duration_seconds<'Infinity'::numeric)
);
alter table public.clip_processing_allowances enable row level security;
create policy clip_allowance_select on public.clip_processing_allowances for select to authenticated using (
  exists(select 1 from public.clip_jobs j where j.id=clip_job_id and public.is_workspace_member(j.workspace_id))
);
revoke all on public.clip_processing_allowances from public,anon,authenticated;
grant select on public.clip_processing_allowances to authenticated;
grant all on public.clip_processing_allowances to service_role;
create index clip_processing_allowances_job on public.clip_processing_allowances(clip_job_id);

create function public.protect_exact_cut_clip() returns trigger language plpgsql
security invoker set search_path='' as $$
declare v_job public.clip_jobs%rowtype; v_duration numeric;
begin
  select * into v_job from public.clip_jobs where id=case when tg_op='INSERT' then new.clip_job_id else old.clip_job_id end;
  if v_job.creation_idempotency_key is null then return new; end if;
  if tg_op='UPDATE' and (new.clip_job_id is distinct from old.clip_job_id
    or new.clip_candidate_id is distinct from old.clip_candidate_id) then
    raise exception 'immutable_clip_parent' using errcode='42501';
  end if;
  if new.current_version_id is not null and not exists(
    select 1 from public.clip_versions where id=new.current_version_id and clip_id=new.id
  ) then raise exception 'clip_version_mismatch' using errcode='42501'; end if;
  if tg_op='INSERT' and v_job.settings_json->>'mode'='manual_timestamp' then
    if current_user in ('anon','authenticated') then
      raise exception 'worker_materialization_required' using errcode='42501';
    end if;
    select end_seconds-start_seconds into v_duration from public.clip_candidates
      where id=new.clip_candidate_id and clip_job_id=new.clip_job_id and origin='manual_timestamp';
    if v_duration is null then raise exception 'exact_cut_candidate_required'; end if;
    insert into public.clip_processing_allowances(clip_id,clip_job_id,duration_seconds)
      values(new.id,new.clip_job_id,v_duration);
  end if;
  return new;
end $$;
-- AFTER INSERT is required because the allowance references the new clip.
create trigger exact_cut_clip_contract after insert or update on public.clips
  for each row execute function public.protect_exact_cut_clip();
revoke all on function public.protect_exact_cut_clip() from public,anon,authenticated;

create function public.enforce_exact_cut_edit_allowance() returns trigger language plpgsql
security definer set search_path='' as $$
declare
  v_job public.clip_jobs%rowtype; v_clip public.clips%rowtype;
  v_period public.usage_periods%rowtype; v_plan public.plans%rowtype;
  v_start numeric; v_end numeric; v_allowance numeric; v_extra bigint;
begin
  select * into v_clip from public.clips where id=new.clip_id;
  select * into v_job from public.clip_jobs where id=v_clip.clip_job_id for update;
  if v_job.creation_idempotency_key is null or v_job.settings_json->>'mode' is distinct from 'manual_timestamp' then return new; end if;
  if v_clip.deleted_at is not null or v_job.status in ('failed','cancelled','expiring','expired') or v_job.retention_expires_at<=now() then
    raise exception 'clip_no_longer_editable' using errcode='22023';
  end if;
  if jsonb_typeof(new.edit_manifest_json->'startSeconds') is distinct from 'number'
    or jsonb_typeof(new.edit_manifest_json->'endSeconds') is distinct from 'number' then
    raise exception 'invalid_clip_range' using errcode='22023';
  end if;
  v_start:=(new.edit_manifest_json->>'startSeconds')::numeric;
  v_end:=(new.edit_manifest_json->>'endSeconds')::numeric;
  if v_start<0 or v_end<=v_start or v_end>v_job.source_duration_seconds
    or trunc(v_start*1000)<>v_start*1000 or trunc(v_end*1000)<>v_end*1000 then
    raise exception 'invalid_clip_range' using errcode='22023';
  end if;
  select duration_seconds into v_allowance from public.clip_processing_allowances where clip_id=new.clip_id for update;
  if not found then raise exception 'clip_processing_allowance_missing'; end if;
  if v_job.committed_source_seconds=0 then
    if new.version_number<>1 or not exists(select 1 from public.clip_candidates where id=v_clip.clip_candidate_id
      and start_seconds=v_start and end_seconds=v_end) then raise exception 'clip_not_ready_for_editing'; end if;
    return new;
  end if;
  v_extra:=greatest(0,ceil(v_end-v_start-v_allowance)::bigint);
  if v_extra=0 then return new; end if;
  select p.* into v_plan from public.profiles pr join public.plans p on p.key=pr.plan_key where pr.id=v_job.user_id and p.active;
  if not found then raise exception 'plan_not_available'; end if;
  insert into public.usage_periods(workspace_id,plan_key,period_start,period_end,source_seconds_limit)
    values(v_job.workspace_id,v_plan.key,date_trunc('month',now()),date_trunc('month',now())+interval '1 month',v_plan.monthly_source_seconds)
    on conflict(workspace_id,period_start) do update set updated_at=now() returning * into v_period;
  if v_period.source_seconds_reserved+v_period.source_seconds_committed+v_extra>v_period.source_seconds_limit then
    raise exception 'Not enough processing minutes to extend this clip. Shorten the range or upgrade your plan.' using errcode='22023';
  end if;
  update public.usage_periods set source_seconds_committed=source_seconds_committed+v_extra,updated_at=now() where id=v_period.id;
  update public.clip_jobs set committed_source_seconds=committed_source_seconds+v_extra where id=v_job.id;
  update public.clip_processing_allowances set duration_seconds=duration_seconds+v_extra where clip_id=new.clip_id;
  insert into public.usage_ledger(workspace_id,user_id,job_id,category,amount,unit,direction,state,idempotency_key,description)
    values(v_job.workspace_id,v_job.user_id,v_job.id,'source_analysis',v_extra,'seconds','debit','committed',
      new.id::text||':exact-cut:extension','Additional Exact Cut duration saved');
  return new;
end $$;
create trigger exact_cut_version_allowance before insert on public.clip_versions
  for each row execute function public.enforce_exact_cut_edit_allowance();
revoke all on function public.enforce_exact_cut_edit_allowance() from public,anon,authenticated;

create function public.get_clip_processing_allowance(p_clip_id uuid) returns numeric
language sql stable security invoker set search_path='' as $$
  select duration_seconds from public.clip_processing_allowances where clip_id=p_clip_id;
$$;
revoke all on function public.get_clip_processing_allowance(uuid) from public,anon;
grant execute on function public.get_clip_processing_allowance(uuid) to authenticated;

-- Clips intentionally have no browser UPDATE policy. Activate an immutable
-- version through this narrow boundary instead of silently updating zero rows.
create function public.activate_clip_version(p_clip_id uuid,p_version_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_job public.clip_jobs%rowtype; v_version public.clip_versions%rowtype;
begin
  select j.* into v_job from public.clip_jobs j join public.clips c on c.clip_job_id=j.id
    where c.id=p_clip_id and c.deleted_at is null for update of j;
  if not found or auth.uid() is null or not public.is_workspace_member(v_job.workspace_id)
    or v_job.status in ('failed','cancelled','expiring','expired') or v_job.retention_expires_at<=now() then
    raise exception 'clip_not_available' using errcode='42501';
  end if;
  select * into v_version from public.clip_versions where id=p_version_id and clip_id=p_clip_id;
  if not found then raise exception 'clip_version_mismatch' using errcode='42501'; end if;
  update public.clips set current_version_id=v_version.id,
    title=coalesce(nullif(v_version.edit_manifest_json->>'title',''),title),
    duration_seconds=(v_version.edit_manifest_json->>'endSeconds')::numeric-(v_version.edit_manifest_json->>'startSeconds')::numeric,
    updated_at=now() where id=p_clip_id;
  return true;
end $$;
revoke all on function public.activate_clip_version(uuid,uuid) from public,anon;
grant execute on function public.activate_clip_version(uuid,uuid) to authenticated;

-- Enable the wizard only after ALL accounting guards exist. Deploy the matching
-- worker before applying this ordered migration set and the matching web app.
create function public.clip_studio_capabilities() returns jsonb language sql stable
security invoker set search_path='' as $$
  select jsonb_build_object('exactCut',auth.uid() is not null);
$$;
revoke all on function public.clip_studio_capabilities() from public,anon;
grant execute on function public.clip_studio_capabilities() to authenticated;

commit;
