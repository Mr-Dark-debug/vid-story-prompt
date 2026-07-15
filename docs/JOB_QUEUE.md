# Job queue

Job submission writes `clip_jobs`, `job_tasks`, usage reservation, rights attestation and `outbox_events` in one transaction. Outbox dispatch writes PGMQ wake messages. Workers claim eligible task rows with `FOR UPDATE SKIP LOCKED`, set a visibility lease and heartbeat until completion.

Retryable failures include provider throttling/5xx, temporary network/storage faults and expired leases. Invalid media, unsupported streams, missing rights, limits, deletion, cancellation and exhausted invalid AI output do not retry. Exponential backoff uses jitter and bounded attempts. Exhaustion becomes `dead_lettered`. Preview children settle independently and yield `partially_ready` when appropriate.

Connector imports use a separate `connector_tasks` lease table so browsing never reserves source-analysis usage and incomplete remote transfers cannot create clip jobs. The task contract includes metadata resolution, token refresh, enumeration, streaming, checksum, validation, attachment, cleanup, disconnect and revocation types. `stream_remote_asset` is implemented for configured Drive, Dropbox and OneDrive connections; unsupported task types fail closed. Connector task progress and errors are mirrored into `connector_imports`.
