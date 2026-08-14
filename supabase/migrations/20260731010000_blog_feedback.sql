begin;

create table if not exists public.blog_feedback (
  id uuid primary key default gen_random_uuid(),
  article_slug text not null
    check (
      char_length(article_slug) between 1 and 160
      and article_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    ),
  user_id uuid references public.profiles(id) on delete cascade,
  anonymous_session_hash bytea,
  vote text not null check (vote in ('helpful', 'not_helpful')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(user_id, anonymous_session_hash) = 1),
  check (anonymous_session_hash is null or octet_length(anonymous_session_hash) = 32)
);

create unique index if not exists blog_feedback_article_user_uidx
  on public.blog_feedback(article_slug, user_id)
  where user_id is not null;

create unique index if not exists blog_feedback_article_anonymous_uidx
  on public.blog_feedback(article_slug, anonymous_session_hash)
  where user_id is null and anonymous_session_hash is not null;

alter table public.blog_feedback enable row level security;

revoke all on table public.blog_feedback from public, anon, authenticated;
grant select, insert, update, delete on table public.blog_feedback to service_role;

create or replace function public.submit_blog_feedback(
  p_article_slug text,
  p_vote text,
  p_user_id uuid default null,
  p_anonymous_session_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := p_user_id;
  v_anonymous_hash bytea;
begin
  if p_article_slug is null
    or char_length(p_article_slug) not between 1 and 160
    or p_article_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  then
    raise exception using errcode = '22023', message = 'invalid article slug';
  end if;

  if p_vote is null or p_vote not in ('helpful', 'not_helpful') then
    raise exception using errcode = '22023', message = 'invalid feedback vote';
  end if;

  if v_user_id is not null then
    insert into public.blog_feedback(article_slug, user_id, anonymous_session_hash, vote)
    values (p_article_slug, v_user_id, null, p_vote)
    on conflict (article_slug, user_id) where user_id is not null
    do update set vote = excluded.vote, updated_at = now();
  else
    if p_anonymous_session_id is null then
      raise exception using errcode = '22023', message = 'anonymous session is required';
    end if;

    v_anonymous_hash := public.digest(
      convert_to(p_anonymous_session_id::text, 'UTF8'),
      'sha256'
    );

    insert into public.blog_feedback(article_slug, user_id, anonymous_session_hash, vote)
    values (p_article_slug, null, v_anonymous_hash, p_vote)
    on conflict (article_slug, anonymous_session_hash)
      where user_id is null and anonymous_session_hash is not null
    do update set vote = excluded.vote, updated_at = now();
  end if;

  return jsonb_build_object('accepted', true);
end;
$$;

revoke all on function public.submit_blog_feedback(text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_blog_feedback(text, text, uuid, uuid)
  to service_role;

commit;
