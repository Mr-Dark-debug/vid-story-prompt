create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_workspace_id uuid;
  new_display_name text;
  new_avatar_url text;
begin
  new_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, 'User'), '@', 1)
  );
  new_avatar_url := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'picture'), '')
  );

  insert into public.profiles (id, email, display_name, avatar_url)
  values (new.id, coalesce(new.email, ''), new_display_name, new_avatar_url);

  insert into public.workspaces (name, owner_id)
  values (coalesce(new_display_name, 'My workspace'), new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');
  return new;
end;
$$;

update public.profiles as profile
set
  display_name = case
    when nullif(btrim(profile.display_name), '') is null
      or lower(profile.display_name) = lower(split_part(profile.email, '@', 1))
    then coalesce(
      nullif(btrim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(auth_user.raw_user_meta_data ->> 'name'), ''),
      profile.display_name
    )
    else profile.display_name
  end,
  avatar_url = coalesce(
    profile.avatar_url,
    nullif(btrim(auth_user.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(btrim(auth_user.raw_user_meta_data ->> 'picture'), '')
  ),
  updated_at = now()
from auth.users as auth_user
where profile.id = auth_user.id
  and (
    profile.avatar_url is null
    or nullif(btrim(profile.display_name), '') is null
    or lower(profile.display_name) = lower(split_part(profile.email, '@', 1))
  );
