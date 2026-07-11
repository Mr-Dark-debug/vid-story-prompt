begin;
create table public.oauth_connections(
  id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,provider text not null check(provider in('google_youtube')),access_token_encrypted text not null,refresh_token_encrypted text,token_expires_at timestamptz,scopes text[] not null default '{}',provider_account_id text,metadata_json jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,provider)
);
alter table public.oauth_connections enable row level security;
create policy oauth_connections_select on public.oauth_connections for select to authenticated using(user_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy oauth_connections_insert on public.oauth_connections for insert to authenticated with check(user_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy oauth_connections_update on public.oauth_connections for update to authenticated using(user_id=auth.uid() and public.is_workspace_member(workspace_id)) with check(user_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy oauth_connections_delete on public.oauth_connections for delete to authenticated using(user_id=auth.uid() and public.is_workspace_member(workspace_id));
commit;
