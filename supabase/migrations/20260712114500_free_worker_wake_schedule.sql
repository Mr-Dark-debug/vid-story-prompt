begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists supabase_vault with schema vault;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.wake_video_worker_if_needed()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1
    from public.job_tasks
    where (
      status in ('queued', 'retry_wait')
      and coalesce(next_attempt_at, now()) <= now()
    ) or (
      status in ('leased', 'running')
      and coalesce(lease_expires_at, now()) >= now() - interval '5 minutes'
    )
  ) then
    return 'idle';
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'video_worker_wake_url'
  order by created_at desc
  limit 1;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'video_worker_wake_secret'
  order by created_at desc
  limit 1;

  if nullif(v_url, '') is null or nullif(v_secret, '') is null then
    return 'missing_configuration';
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'authorization', 'Bearer ' || v_secret,
      'content-type', 'application/json'
    ),
    body := jsonb_build_object('source', 'supabase_cron'),
    timeout_milliseconds := 8000
  );
  return 'requested';
end;
$$;

revoke all on function private.wake_video_worker_if_needed() from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'wake-video-worker' limit 1;
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'wake-video-worker',
    '* * * * *',
    'select private.wake_video_worker_if_needed()'
  );
end;
$$;

commit;
