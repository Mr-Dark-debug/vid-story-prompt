begin;

update public.job_tasks
set error_message = 'YouTube blocked this cloud worker after every protected download path was tried. Try again later, or use an original file or owner-controlled direct media link.'
where task_type = 'download_youtube_source'
  and status = 'dead_lettered'
  and error_code = 'provider_auth_challenge';

update public.clip_jobs
set error_message = 'YouTube blocked this cloud worker after every protected download path was tried. Try again later, or use an original file or owner-controlled direct media link.',
    updated_at = now()
where status = 'failed'
  and error_code = 'provider_auth_challenge';

update public.processing_events
set message = 'YouTube blocked this cloud worker after every protected download path was tried. Try again later, or use an original file or owner-controlled direct media link.'
where stage = 'download_youtube_source'
  and severity = 'error'
  and message = 'YouTube temporarily challenged the video worker. Vidrial will retry.';

commit;
