begin;

create table public.connector_tasks(
  id uuid primary key default gen_random_uuid(),
  connector_import_id uuid not null references public.connector_imports(id) on delete cascade,
  task_type text not null check(task_type in(
    'resolve_connector_source','refresh_connector_token','enumerate_remote_assets',
    'fetch_remote_metadata','start_remote_import','stream_remote_asset',
    'verify_import_checksum','validate_imported_media','attach_source_to_clip_job',
    'clean_failed_import','disconnect_connector','revoke_connector_token'
  )),
  status text not null default 'queued' check(status in('queued','leased','running','retry_wait','succeeded','failed','dead_lettered','cancelled')),
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  attempt integer not null default 0,
  max_attempts integer not null default 5,
  priority integer not null default 10,
  idempotency_key text not null unique,
  lease_owner text,lease_expires_at timestamptz,last_heartbeat_at timestamptz,
  progress_current bigint,progress_total bigint,next_attempt_at timestamptz not null default now(),
  error_code text,error_message text,created_at timestamptz not null default now(),
  started_at timestamptz,completed_at timestamptz
);
create index connector_tasks_claim_idx on public.connector_tasks(status,next_attempt_at,priority desc,created_at);
alter table public.connector_tasks enable row level security;
create policy connector_tasks_select on public.connector_tasks for select to authenticated using(exists(
  select 1 from public.connector_imports i where i.id=connector_import_id and i.user_id=auth.uid() and public.is_workspace_member(i.workspace_id)
));
grant select on public.connector_tasks to authenticated;

-- Provider imports create media assets with their real provenance.
alter table public.media_assets drop constraint if exists media_assets_source_type_check;
alter table public.media_assets add constraint media_assets_source_type_check check(source_type in(
  'local_upload','direct_owned_media_url','youtube_metadata','youtube_connected_channel',
  'google_drive','dropbox','onedrive','rss','s3'
));
alter table public.clip_jobs drop constraint if exists clip_jobs_source_type_check;
alter table public.clip_jobs add constraint clip_jobs_source_type_check check(source_type in(
  'local_upload','direct_owned_media_url','youtube_metadata','youtube_connected_channel',
  'google_drive','dropbox','onedrive','rss','s3'
));

create or replace function public.claim_connector_task(p_worker_id text,p_lease_seconds integer default 120)
returns setof public.connector_tasks language plpgsql security definer set search_path='' as $$
declare v_task public.connector_tasks%rowtype;
begin
  select * into v_task from public.connector_tasks
  where status in('queued','retry_wait') and next_attempt_at<=now()
    and (lease_expires_at is null or lease_expires_at<now())
  order by priority desc,created_at for update skip locked limit 1;
  if not found then return;end if;
  update public.connector_tasks set status='leased',lease_owner=p_worker_id,
    lease_expires_at=now()+make_interval(secs=>greatest(30,p_lease_seconds)),attempt=attempt+1,
    last_heartbeat_at=now() where id=v_task.id returning * into v_task;
  return next v_task;
end;$$;

create or replace function public.start_connector_task(p_task_id uuid,p_worker_id text)
returns boolean language sql security definer set search_path='' as $$
  update public.connector_tasks set status='running',started_at=coalesce(started_at,now())
  where id=p_task_id and lease_owner=p_worker_id and lease_expires_at>now() returning true;
$$;

create or replace function public.heartbeat_connector_task(p_task_id uuid,p_worker_id text,p_lease_seconds integer,p_current bigint default null,p_total bigint default null)
returns boolean language sql security definer set search_path='' as $$
  update public.connector_tasks set lease_expires_at=now()+make_interval(secs=>greatest(30,p_lease_seconds)),
    last_heartbeat_at=now(),progress_current=coalesce(p_current,progress_current),progress_total=coalesce(p_total,progress_total)
  where id=p_task_id and lease_owner=p_worker_id and status='running' returning true;
$$;

create or replace function public.complete_connector_task(p_task_id uuid,p_worker_id text,p_output jsonb default '{}')
returns boolean language plpgsql security definer set search_path='' as $$
declare v_task public.connector_tasks%rowtype;
begin
  select * into v_task from public.connector_tasks where id=p_task_id and lease_owner=p_worker_id for update;
  if not found then return false;end if;
  update public.connector_tasks set status='succeeded',output_json=coalesce(p_output,'{}'),
    lease_owner=null,lease_expires_at=null,completed_at=now() where id=p_task_id;
  return true;
end;$$;

create or replace function public.fail_connector_task(p_task_id uuid,p_worker_id text,p_error_code text,p_error_message text,p_retryable boolean,p_next_attempt_at timestamptz default null)
returns text language plpgsql security definer set search_path='' as $$
declare v_task public.connector_tasks%rowtype;v_status text;
begin
  select * into v_task from public.connector_tasks where id=p_task_id and lease_owner=p_worker_id for update;
  if not found then return 'lease_lost';end if;
  v_status=case when p_error_code='cancelled' then 'cancelled' when p_retryable and v_task.attempt<v_task.max_attempts then 'retry_wait' when p_retryable then 'dead_lettered' else 'failed' end;
  update public.connector_tasks set status=v_status,error_code=p_error_code,error_message=left(p_error_message,2000),
    next_attempt_at=case when v_status='retry_wait' then coalesce(p_next_attempt_at,now()+interval '1 minute') else next_attempt_at end,
    lease_owner=null,lease_expires_at=null,completed_at=case when v_status in('failed','dead_lettered','cancelled') then now() else null end where id=p_task_id;
  update public.connector_imports set status=case when status='cancelled' or v_status='cancelled' then 'cancelled' when v_status='retry_wait' then 'retry_wait' else 'failed' end,
    attempt=v_task.attempt,error_code=case when status='cancelled' then error_code else p_error_code end,
    error_message=case when status='cancelled' then error_message else left(p_error_message,2000) end,updated_at=now() where id=v_task.connector_import_id;
  return v_status;
end;$$;

revoke all on function public.claim_connector_task(text,integer),public.start_connector_task(uuid,text),
 public.heartbeat_connector_task(uuid,text,integer,bigint,bigint),public.complete_connector_task(uuid,text,jsonb),
 public.fail_connector_task(uuid,text,text,text,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_connector_task(text,integer),public.start_connector_task(uuid,text),
 public.heartbeat_connector_task(uuid,text,integer,bigint,bigint),public.complete_connector_task(uuid,text,jsonb),
 public.fail_connector_task(uuid,text,text,text,boolean,timestamptz) to service_role;

commit;
