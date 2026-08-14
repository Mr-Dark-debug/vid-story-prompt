alter table public.clip_candidates
  add column if not exists social_copy_json jsonb not null default '{}'::jsonb;

comment on column public.clip_candidates.social_copy_json is
  'Validated platform-specific copy suggestions generated for this candidate; never provider credentials or publish state.';

create or replace function public.update_clip_candidate_copy(
  p_clip_id uuid,
  p_title text,
  p_social_copy_json jsonb
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  candidate_id uuid;
begin
  if length(trim(p_title)) < 1 or length(p_title) > 120 then
    raise exception 'invalid_clip_title';
  end if;
  select clip_candidate_id into candidate_id
  from public.clips
  where id = p_clip_id and deleted_at is null;
  if candidate_id is null then return false; end if;
  update public.clip_candidates
  set title = p_title, social_copy_json = p_social_copy_json, updated_at = now()
  where id = candidate_id;
  update public.clips set title = p_title, updated_at = now() where id = p_clip_id;
  return found;
end;
$$;

revoke all on function public.update_clip_candidate_copy(uuid, text, jsonb) from public;
grant execute on function public.update_clip_candidate_copy(uuid, text, jsonb) to authenticated;
