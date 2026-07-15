# Operations runbook

- Queue stalled: inspect worker `/readyz`, PGMQ/outbox depth, expired leases and provider throttling. Restarting workers is safe.
- Task retry loop: inspect `processing_events`, `error_code`, attempt/max-attempts and provider status. Do not retry invalid media or rights/limit failures.
- Partial results: preserve successful previews and retry only failed preview tasks.
- Storage incident: stop new claims, retain task leases, restore Storage, then allow lease recovery.
- Suspected key exposure: rotate the Supabase secret/service key and database password, update encrypted platform variables and restart web/worker deployments.
- Deletion failure: leave the job `expiring`, retry `delete_expired_assets`, and verify every private bucket prefix before marking `expired`.
- Connector import stalled: inspect `connector_imports`, its leased `connector_tasks` row, byte heartbeats, provider status and worker encryption-key configuration. Cancellation is terminal; retry creates no duplicate asset because the import idempotency key and destination check are authoritative.
- Connector reconnect required: do not expose token errors. Ask the user to reconnect, preserve previously imported media according to retention settings, and verify provider revocation before clearing the incident.
- OAuth callback mismatch: verify `PUBLIC_APP_URL`, the provider console's exact redirect URI, unconsumed `oauth_states` expiry and proxy cookie forwarding. Never relax state or redirect validation.
