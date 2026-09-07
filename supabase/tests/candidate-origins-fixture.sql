-- Isolated schema contract, not a substitute for workspace RLS integration tests.
create table public.planning_runs(id uuid primary key);
create table public.clip_candidates(
  id uuid primary key default gen_random_uuid(),
  planning_run_id uuid not null references public.planning_runs(id),
  start_seconds numeric not null,
  end_seconds numeric not null,
  title text not null,
  hook text not null,
  summary text not null,
  topic text not null,
  transcript_excerpt text not null,
  selection_reason text not null,
  standalone_score numeric not null,
  hook_score numeric not null,
  clarity_score numeric not null,
  story_score numeric not null,
  relevance_score numeric not null,
  technical_score numeric not null,
  overall_score numeric not null,
  check(end_seconds>start_seconds)
);
insert into public.planning_runs(id) values('00000000-0000-4000-8000-000000000001');
insert into public.clip_candidates(
  id,planning_run_id,start_seconds,end_seconds,title,hook,summary,topic,transcript_excerpt,selection_reason,
  standalone_score,hook_score,clarity_score,story_score,relevance_score,technical_score,overall_score
) values(
  '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',0,30,
  'Existing discovery','Hook','Summary','Topic','Excerpt','Explanation',80,80,80,80,80,80,80
);
