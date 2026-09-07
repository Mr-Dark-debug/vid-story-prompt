begin;

-- Existing candidates came from discovery. Selected ranges reuse this same
-- candidate -> clip -> immutable version pipeline, without a fake planning run.
alter table public.clip_candidates
  add column origin text not null default 'ai_discovery'
    check (origin in ('ai_discovery','manual_timestamp','transcript_selection')),
  alter column planning_run_id drop not null,
  alter column standalone_score drop not null,
  alter column hook_score drop not null,
  alter column clarity_score drop not null,
  alter column story_score drop not null,
  alter column relevance_score drop not null,
  alter column technical_score drop not null,
  alter column overall_score drop not null,
  alter column hook set default '',
  alter column summary set default '',
  alter column topic set default '',
  alter column transcript_excerpt set default '',
  alter column selection_reason set default '';

alter table public.clip_candidates add constraint clip_candidate_origin_scores check (
  (origin='ai_discovery' and planning_run_id is not null
    and standalone_score is not null and standalone_score between 0 and 100
    and hook_score is not null and hook_score between 0 and 100
    and clarity_score is not null and clarity_score between 0 and 100
    and story_score is not null and story_score between 0 and 100
    and relevance_score is not null and relevance_score between 0 and 100
    and technical_score is not null and technical_score between 0 and 100
    and overall_score is not null and overall_score between 0 and 100)
  or (origin in ('manual_timestamp','transcript_selection')
    and planning_run_id is null
    and standalone_score is null and hook_score is null and clarity_score is null
    and story_score is null and relevance_score is null and technical_score is null
    and overall_score is null)
);

alter table public.clip_candidates add constraint clip_candidate_finite_range check (
  start_seconds >= 0 and start_seconds < 'Infinity'::numeric
  and end_seconds > start_seconds and end_seconds < 'Infinity'::numeric
);

comment on column public.clip_candidates.origin is
  'How the range was selected. AI discovery is scored; manual/transcript selections are unscored and have no planning run.';
comment on column public.clip_candidates.overall_score is
  'Explainable discovery score in [0,100]; NULL means this user-selected range was not scored. Never coerce NULL into a displayed zero score.';

commit;
