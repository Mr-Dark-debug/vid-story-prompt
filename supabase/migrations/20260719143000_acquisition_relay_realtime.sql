begin;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'acquisition_relay_requests'
    ) then
    alter publication supabase_realtime add table public.acquisition_relay_requests;
  end if;
end;
$$;

commit;
