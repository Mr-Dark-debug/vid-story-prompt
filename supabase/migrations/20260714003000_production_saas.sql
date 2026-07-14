begin;

create table if not exists public.app_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  brief text not null default '' check (char_length(brief) <= 5000),
  aspect text not null default '16:9' check (aspect in ('16:9','9:16','1:1')),
  status text not null default 'draft' check (status in ('draft','in-progress','exported')),
  timeline_json jsonb not null default '{"clips":[],"playhead":0}'::jsonb,
  transcript_edits_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_projects_workspace_updated_idx
  on public.app_projects(workspace_id, updated_at desc);

create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.app_projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  kind text not null default 'manual' check (kind in ('manual','ai')),
  summary text not null default '' check (char_length(summary) <= 1000),
  timeline_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists project_versions_project_created_idx
  on public.project_versions(project_id, created_at desc);

create table if not exists public.project_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text not null,
  aspect text not null check (aspect in ('16:9','9:16','1:1')),
  brief text not null,
  icon text not null default 'sparkles',
  created_at timestamptz not null default now()
);

insert into public.project_templates(slug,name,description,aspect,brief,icon) values
  ('youtube-long-form','YouTube long-form','Cold open, chapters, sponsor slot and a focused outro.','16:9','Build a clear long-form YouTube edit with a strong cold open, useful chapters and a concise ending.','youtube'),
  ('podcast-highlights','Podcast highlights','Conversation-led highlights with readable captions.','16:9','Find complete conversational moments, remove distracting pauses and keep speaker changes easy to follow.','mic'),
  ('short-form-vertical','Short-form vertical','Hook-first 9:16 clips with mobile captions.','9:16','Create a hook-first vertical edit with concise pacing, safe-area captions and a clear final beat.','smartphone'),
  ('course-lesson','Course lesson','Structured teaching edit with chapter markers.','16:9','Create a calm instructional lesson with chapter markers, deliberate pacing and readable supporting text.','graduation'),
  ('product-demo','Product demo','Screen-focused edit with a specific call to action.','16:9','Create a product walkthrough that keeps the active screen readable and ends with one clear call to action.','monitor'),
  ('blank-ai-plan','Blank AI plan','Start with an empty persisted project and your own brief.','16:9','','sparkles')
on conflict (slug) do update set
  name=excluded.name, description=excluded.description, aspect=excluded.aspect,
  brief=excluded.brief, icon=excluded.icon;

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 320),
  topic text not null check (topic in ('general','billing','partnership','trust')),
  message text not null check (char_length(message) between 8 and 2000),
  status text not null default 'new' check (status in ('new','in_progress','resolved','spam')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ai_plan_preview boolean not null default true,
  autosave_seconds integer not null default 30 check (autosave_seconds in (0, 15, 30, 60, 120)),
  snap_to_words boolean not null default true,
  low_resolution_preview boolean not null default false,
  notify_export_complete boolean not null default true,
  notify_ai_plan_complete boolean not null default true,
  notify_weekly_usage boolean not null default false,
  notify_product_updates boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  email text not null,
  plan_interest text not null default 'creator' check (plan_interest in ('creator','pro','business')),
  status text not null default 'interested' check (status in ('interested','invited','converted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_projects enable row level security;
alter table public.project_versions enable row level security;
alter table public.project_templates enable row level security;
alter table public.support_requests enable row level security;
alter table public.user_preferences enable row level security;
alter table public.billing_waitlist enable row level security;

create policy app_projects_select on public.app_projects for select
  using (public.is_workspace_member(workspace_id));
create policy app_projects_insert on public.app_projects for insert
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy app_projects_update on public.app_projects for update
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy app_projects_delete on public.app_projects for delete
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy project_versions_select on public.project_versions for select
  using (public.is_workspace_member(workspace_id));
create policy project_versions_insert on public.project_versions for insert
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy project_versions_delete on public.project_versions for delete
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy project_templates_select on public.project_templates for select
  using (workspace_id is null or public.is_workspace_member(workspace_id));
create policy project_templates_insert on public.project_templates for insert
  with check (user_id = auth.uid() and workspace_id is not null and public.is_workspace_member(workspace_id));
create policy project_templates_update on public.project_templates for update
  using (user_id = auth.uid() and workspace_id is not null and public.is_workspace_member(workspace_id));
create policy project_templates_delete on public.project_templates for delete
  using (user_id = auth.uid() and workspace_id is not null and public.is_workspace_member(workspace_id));

create policy user_preferences_select on public.user_preferences for select
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy user_preferences_insert on public.user_preferences for insert
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy user_preferences_update on public.user_preferences for update
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy user_preferences_delete on public.user_preferences for delete
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy billing_waitlist_select on public.billing_waitlist for select
  using (user_id = auth.uid());
create policy billing_waitlist_insert on public.billing_waitlist for insert
  with check (user_id = auth.uid());
create policy billing_waitlist_update on public.billing_waitlist for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy billing_waitlist_delete on public.billing_waitlist for delete
  using (user_id = auth.uid());

grant select,insert,update,delete on public.app_projects to authenticated;
grant select,insert,delete on public.project_versions to authenticated;
grant select,insert,update,delete on public.project_templates to authenticated;
grant select,insert,update,delete on public.user_preferences to authenticated;
grant select,insert,update,delete on public.billing_waitlist to authenticated;

commit;
