# Job queue

Job submission writes `clip_jobs`, `job_tasks`, usage reservation, rights attestation and `outbox_events` in one transaction. Outbox dispatch writes PGMQ wake messages. Workers claim eligible task rows with `FOR UPDATE SKIP LOCKED`, set a visibility lease and heartbeat until completion.

Retryable failures include provider throttling/5xx, temporary network/storage faults and expired leases. Invalid media, unsupported streams, missing rights, limits, deletion, cancellation and exhausted invalid AI output do not retry. Exponential backoff uses jitter and bounded attempts. Exhaustion becomes `dead_lettered`. Preview children settle independently and yield `partially_ready` when appropriate.
