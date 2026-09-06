begin;
do $$
declare
  v_id uuid;
  v_origin text;
begin
  if not exists(select 1 from public.clip_candidates
    where id='00000000-0000-4000-8000-000000000002' and origin='ai_discovery' and overall_score=80) then
    raise exception 'Legacy candidates were not preserved and backfilled';
  end if;
  foreach v_origin in array array['manual_timestamp','transcript_selection'] loop
    insert into public.clip_candidates(origin,start_seconds,end_seconds,title)
    values(v_origin,30,45,'Selected range') returning id into v_id;
    if not exists(select 1 from public.clip_candidates where id=v_id and planning_run_id is null and overall_score is null) then
      raise exception 'Selected range acquired invented scores or planning run';
    end if;
    begin
      update public.clip_candidates set overall_score=0 where id=v_id;
      raise exception 'Selected range accepted a fabricated score';
    exception when check_violation then null; end;
    begin
      update public.clip_candidates set end_seconds='NaN'::numeric where id=v_id;
      raise exception 'Nonfinite range accepted';
    exception when check_violation then null; end;
    begin
      update public.clip_candidates set start_seconds=-1 where id=v_id;
      raise exception 'Negative start accepted';
    exception when check_violation then null; end;
  end loop;
  begin
    insert into public.clip_candidates(origin,start_seconds,end_seconds,title)
    values('ai_discovery',30,45,'Unscored AI');
    raise exception 'AI candidate accepted without scores/planning run';
  exception when check_violation then null; end;
  begin
    update public.clip_candidates set hook_score=null
    where id='00000000-0000-4000-8000-000000000002';
    raise exception 'AI required scores were weakened';
  exception when check_violation then null; end;
  begin
    insert into public.clip_candidates(origin,start_seconds,end_seconds,title)
    values('unknown',30,45,'Unknown origin');
    raise exception 'Unknown origin accepted';
  exception when check_violation then null; end;
end;
$$;
rollback;
