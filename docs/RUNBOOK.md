# Operations runbook

- Queue stalled: inspect worker `/readyz`, PGMQ/outbox depth, expired leases and provider throttling. Restarting workers is safe.
- Task retry loop: inspect `processing_events`, `error_code`, attempt/max-attempts and provider status. Do not retry invalid media or rights/limit failures.
- Partial results: preserve successful previews and retry only failed preview tasks.
- Storage incident: stop new claims, retain task leases, restore Storage, then allow lease recovery.
- Suspected key exposure: rotate the Supabase secret/service key and database password, update encrypted platform variables and restart web/worker deployments.
- Deletion failure: leave the job `expiring`, retry `delete_expired_assets`, and verify every private bucket prefix before marking `expired`.
