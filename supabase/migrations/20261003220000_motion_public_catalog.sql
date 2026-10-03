begin;

-- Public projection contains no creator IDs or submission/workspace provenance.
-- Its source table remains private; callers only receive moderated content.
create table public.motion_public_catalog as
select * from public.approved_motion_prompts with no data;
alter table public.motion_public_catalog add primary key(id);
alter table public.motion_public_catalog add constraint motion_public_catalog_approved check(status='approved');
alter table public.motion_public_catalog enable row level security;
revoke all on public.motion_public_catalog from anon,authenticated;
grant select on public.motion_public_catalog to anon,authenticated;
grant all on public.motion_public_catalog to service_role;
create policy motion_public_catalog_read on public.motion_public_catalog
for select to anon,authenticated using(status='approved');

create function public.sync_motion_public_catalog() returns trigger
language plpgsql security definer set search_path='' as $$
declare item public.motion_public_catalog;
begin
 if tg_op='DELETE' then
  delete from public.motion_public_catalog where id=old.id;
  return old;
 end if;
 if new.status<>'approved' then
  delete from public.motion_public_catalog where id=new.id;
  return new;
 end if;
 -- jsonb_populate_record copies only explicitly projected public columns.
 item:=jsonb_populate_record(null::public.motion_public_catalog,to_jsonb(new));
 insert into public.motion_public_catalog select item.*
 on conflict(id) do update set
 slug=excluded.slug,title=excluded.title,prompt=excluded.prompt,
 category=excluded.category,tags=excluded.tags,aspect=excluded.aspect,
 duration_seconds=excluded.duration_seconds,recommended_model=excluded.recommended_model,
 source=excluded.source,author_display_name=excluded.author_display_name,
 license=excluded.license,status=excluded.status,preview_asset_path=excluded.preview_asset_path,
 poster_path=excluded.poster_path,view_count=excluded.view_count,like_count=excluded.like_count,
 copy_count=excluded.copy_count,use_count=excluded.use_count,created_at=excluded.created_at;
 return new;
end $$;
revoke all on function public.sync_motion_public_catalog() from public,anon,authenticated;
grant execute on function public.sync_motion_public_catalog() to service_role;
create trigger sync_motion_public_catalog after insert or update or delete on public.motion_prompts
for each row execute function public.sync_motion_public_catalog();

insert into public.motion_public_catalog select * from public.approved_motion_prompts;
create or replace view public.approved_motion_prompts
with(security_invoker=true,security_barrier=true) as
select * from public.motion_public_catalog where status='approved';

commit;
