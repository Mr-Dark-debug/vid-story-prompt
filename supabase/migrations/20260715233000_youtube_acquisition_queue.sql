begin;

-- The existing clip-job insert trigger owns initial source acquisition. Keep
-- direct links unchanged and add an explicit YouTube branch so metadata jobs
-- without an attached asset can enter the worker pipeline.
create or replace function public.enqueue_direct_source_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_task_id uuid := gen_random_uuid();
  v_task_type text;
  v_input jsonb;
  v_idempotency_key text;
begin
  if new.source_type = 'direct_owned_media_url' and new.source_asset_id is null then
    v_task_type := 'download_direct_source';
    v_input := jsonb_build_object('url', new.source_url);
    v_idempotency_key := new.id::text || ':download-direct';
  elsif new.source_type in ('youtube_metadata', 'youtube_connected_channel')
    and new.source_asset_id is null then
    if new.youtube_video_id is null or new.youtube_video_id !~ '^[A-Za-z0-9_-]{11}$' then
      raise exception 'invalid_youtube_video_id' using errcode = '22023';
    end if;
    v_task_type := 'download_youtube_source';
    v_input := jsonb_build_object('videoId', new.youtube_video_id);
    v_idempotency_key := new.id::text || ':download-youtube';
  else
    return new;
  end if;

  insert into public.job_tasks (
    id, clip_job_id, task_type, status, priority, input_json, idempotency_key, next_attempt_at
  ) values (
    v_task_id, new.id, v_task_type, 'queued', new.priority, v_input, v_idempotency_key, now()
  ) on conflict (idempotency_key) do nothing;

  if found then
    insert into public.outbox_events (aggregate_type, aggregate_id, event_type, payload_json)
    values (
      'clip_job', new.id, 'task.queued',
      jsonb_build_object(
        'jobId', new.id,
        'taskId', v_task_id,
        'taskType', v_task_type
      )
    );
  end if;
  return new;
end;
$$;

update public.connector_definitions
set capabilities = case
  when capabilities @> array['download_original']::text[] then capabilities
  else array_append(capabilities, 'download_original')
end,
configuration_json = configuration_json || jsonb_build_object(
  'mediaAcquisition', 'server_ytdlp',
  'rightsAttestationRequired', true
),
updated_at = now()
where id = 'youtube';

revoke all on function public.enqueue_direct_source_task() from public, anon, authenticated;

commit;
