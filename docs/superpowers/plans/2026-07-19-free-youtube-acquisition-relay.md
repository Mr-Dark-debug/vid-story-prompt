# Free YouTube Acquisition Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free, asynchronous YouTube acquisition chain with measured WARP rotation, an optional self-hosted Cobalt adapter, a secure residential-device helper, durable callbacks, and deduplicated user toasts.

**Architecture:** A database-backed attempt planner records one bounded acquisition path at a time. The cloud worker tries configured operator/WARP/Cobalt paths; exhausted cloud challenges create a job-scoped relay request that a paired local helper can lease, download through the user's residential connection, and complete through immutable Supabase storage. Signed callbacks persist events, while Supabase Realtime drives durable, deduplicated browser toasts.

**Tech Stack:** PostgreSQL/Supabase RLS and RPCs, TanStack Start, React 19, Supabase Realtime and Storage, Node/Bun TypeScript, yt-dlp, FFmpeg, Cloudflare WARP, optional Cobalt HTTP API, Vitest, Playwright.

## Global Constraints

- Preserve `YTDLP_PROXY_URL` as the highest-priority operator override.
- Never expose service-role, proxy, Cobalt, signing, webhook, or device credentials to the browser bundle.
- Never upload YouTube/Google cookies to Vidrial; optional cookies remain local to the helper.
- Production never silently falls back to direct datacenter egress.
- All storage paths follow `{workspace_id}/{user_id}/{job_id}/{asset_type}/{uuid}.{extension}`.
- Keep the existing same-job authorised-source fallback operational throughout delivery.
- Do not edit `src/routeTree.gen.ts` manually.
- Use semantic brand tokens, Manrope fallback, accessible text plus icons, and support 360px viewports.
- Do not claim Cobalt, WARP, Docker, deployment, or end-to-end success without real verification.
- Do not force-push, rebase, amend, or squash published Lovable commits.

---

## File map

- `supabase/migrations/20260719xxxxxx_source_acquisition_attempts.sql`: acquisition attempt, relay device/request, callback idempotency, RLS, and transition RPCs.
- `services/video-worker/src/security/youtube-egress-pool.ts`: proxy-pool parsing, keyed fingerprints, deduplication, and health planning.
- `services/video-worker/src/security/acquisition-plan.ts`: pure attempt selection and terminal classification.
- `services/video-worker/src/security/cobalt-download.ts`: current Cobalt API client and bounded media retrieval.
- `services/video-worker/src/tasks/youtube-acquisition.ts`: one-attempt execution and audit persistence.
- `services/video-worker/src/health/proxy-health.ts`: pool-level health snapshot.
- `services/video-worker/start.sh` and `services/video-worker/warp/entrypoint.sh`: configurable multi-process WARP startup.
- `src/services/acquisition/relay-token.server.ts`: capability signing, hashing, verification, and replay-safe claims.
- `src/services/acquisition/relay.server.ts`: pairing, lease, progress, completion, revocation, and orphan cleanup server functions.
- `src/routes/api.acquisition.relay.$action.ts`: signed helper callback HTTP surface.
- `services/local-acquisition-helper/`: least-privilege helper CLI, local yt-dlp execution, heartbeat, upload, and packaging.
- `src/components/app/job-toast-coordinator.tsx`: realtime/polling reconciliation and toast deduplication.
- `src/components/youtube-clipper/local-relay-recovery.tsx`: pairing and action-required UX.
- `src/components/dashboard/WorkerEgressBadge.tsx`: sanitized pool/helper health.

---

### Task 1: Persist normalized acquisition and relay state

**Files:**
- Create: `supabase/migrations/20260719120000_free_youtube_acquisition_relay.sql`
- Modify: `src/lib/supabase/database.types.ts`
- Test: Supabase migration/RLS integration through the existing local Supabase scripts

**Interfaces:**
- Produces tables `source_acquisition_attempts`, `acquisition_relay_devices`, `acquisition_relay_requests`, and `acquisition_callback_receipts`.
- Produces RPCs `record_source_acquisition_attempt`, `create_acquisition_relay_request`, `lease_acquisition_relay_request`, `heartbeat_acquisition_relay_request`, `complete_acquisition_relay_request`, and `fail_acquisition_relay_request`.

- [ ] **Step 1: Write the migration with strict checks and RLS**

Define constrained status/tier columns, unique `(job_task_id, ordinal)` and idempotency keys, hashed capability/device credentials, expiry checks, and foreign keys. Add `source_tier`, `pool_member_index`, and `acquisition_attempt_id` to `processing_events`. Browser roles receive read-only workspace-scoped policies; mutation functions use `security definer`, `set search_path = ''`, `auth.uid()` or service-role-only grants, and row locks.

- [ ] **Step 2: Add idempotent transition functions**

Each function must return the existing terminal result for duplicate provider event IDs/nonces, reject cross-workspace access, reject expired/revoked credentials, prevent two live leases, and write one durable `processing_events` row per state boundary.

- [ ] **Step 3: Apply locally and verify failure cases**

Run: `npm run supabase:reset`

Expected: migrations complete; anonymous mutation is denied; workspace A cannot read workspace B relay state; duplicate completion returns the prior result without another validation task.

- [ ] **Step 4: Regenerate database types**

Run: `npm run supabase:types`

Expected: generated types include all four tables, new event columns, and RPC signatures.

- [ ] **Step 5: Commit**

Run: `git add supabase/migrations/20260719120000_free_youtube_acquisition_relay.sql src/lib/supabase/database.types.ts && git commit -m "feat: persist youtube acquisition relay state"`

### Task 2: Add pure acquisition planning and WARP-pool selection

**Files:**
- Create: `services/video-worker/src/security/youtube-egress-pool.ts`
- Create: `services/video-worker/src/security/youtube-egress-pool.test.ts`
- Create: `services/video-worker/src/security/acquisition-plan.ts`
- Create: `services/video-worker/src/security/acquisition-plan.test.ts`
- Modify: `services/video-worker/src/config/env.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces `parseProxyPool(value?: string): PoolMember[]`.
- Produces `deduplicateHealthyEgress(members, fingerprintKey): UniquePoolMember[]`.
- Produces `nextAcquisitionAttempt(input): PlannedAcquisitionAttempt | null`.

- [ ] **Step 1: Write failing pool tests**

Cover trimmed comma-separated URLs, unsupported schemes, embedded credentials redaction, duplicate measured IPs, partial outage, stable indices, and empty configuration.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm --prefix services/video-worker test -- youtube-egress-pool.test.ts`

Expected: FAIL because the pool module does not exist.

- [ ] **Step 3: Implement pool parsing and keyed fingerprints**

Use `createHmac("sha256", fingerprintKey).update(rawIp).digest("base64url")`; never return the raw address from browser-facing structures. Normalize only `http`, `https`, `socks5`, and `socks5h` URLs and keep proxy URLs out of error messages.

- [ ] **Step 4: Write planner tests**

Cover operator override precedence, no production direct path, unique `(fingerprint,strategy)` pairs, unhealthy-member skipping, Cobalt after WARP exhaustion, relay after cloud exhaustion, terminal restriction short-circuiting, cancellation, and total exhaustion.

- [ ] **Step 5: Implement the pure planner**

Define explicit `sourceTier`, `strategy`, `poolMemberIndex`, and `proxy` fields. Never derive a tier from task-attempt modulo arithmetic.

- [ ] **Step 6: Add validated environment values**

Add `WARP_POOL_URLS`, `WARP_POOL_SIZE`, `WARP_POOL_BASE_PORT`, `WARP_POOL_MIN_HEALTHY`, `EGRESS_FINGERPRINT_KEY`, `COBALT_API_URL`, `COBALT_API_KEY`, `COBALT_REQUEST_TIMEOUT_MS`, `LOCAL_RELAY_ENABLED`, and `LOCAL_RELAY_SIGNING_KEY` with safe empty-string preprocessing and minimum secret lengths.

- [ ] **Step 7: Run focused tests and commit**

Run: `npm --prefix services/video-worker test -- youtube-egress-pool.test.ts acquisition-plan.test.ts`

Expected: PASS.

Run: `git add services/video-worker/src/security services/video-worker/src/config/env.ts .env.example && git commit -m "feat: plan bounded youtube acquisition paths"`

### Task 3: Measure and expose distinct WARP members

**Files:**
- Modify: `services/video-worker/start.sh`
- Modify: `services/video-worker/warp/entrypoint.sh`
- Modify: `services/video-worker/warp/healthcheck.sh`
- Modify: `services/video-worker/warp/health-response.sh`
- Modify: `services/video-worker/warp/docker-compose.test.yml`
- Modify: `services/video-worker/src/health/proxy-health.ts`
- Modify: `services/video-worker/src/health/proxy-health.test.ts`
- Modify: `services/video-worker/src/http/server.ts`
- Modify: `services/video-worker/src/http/server.test.ts`

**Interfaces:**
- Produces `ProxyPoolHealthSnapshot` with configured, healthy, unique, checked-at, and sanitized member states.

- [ ] **Step 1: Extend failing health tests**

Assert that duplicate trace IPs count once, blocked members do not make the pool healthy, exact IPs and proxy URLs are absent from serialized health, and `/health/proxy` stays bearer-protected.

- [ ] **Step 2: Implement multi-process lifecycle**

Start `WARP_POOL_SIZE` processes on sequential loopback ports with separate data directories. Track every PID, stop all children on signals, persist registration data where configured, and fail only according to `WARP_POOL_MIN_HEALTHY`.

- [ ] **Step 3: Implement bounded probes and deduplication**

Probe every configured listener concurrently with per-member timeouts, fingerprint the trace IP, group duplicates, quarantine failures until the next scheduled health cycle, and expose counts without raw IPs.

- [ ] **Step 4: Run worker tests and optional Compose smoke test**

Run: `npm --prefix services/video-worker test -- proxy-health.test.ts server.test.ts`

Expected: PASS.

If Docker exists, run: `docker compose -f services/video-worker/warp/docker-compose.test.yml up --abort-on-container-exit`

Expected: exit 0; every healthy member reports `warp=on`; duplicate egress is reported as reduced unique capacity rather than a false failure.

- [ ] **Step 5: Commit**

Run: `git add services/video-worker/start.sh services/video-worker/warp services/video-worker/src/health services/video-worker/src/http && git commit -m "feat: measure distinct WARP egress members"`

### Task 4: Add a current, bounded Cobalt adapter

**Files:**
- Create: `services/video-worker/src/security/cobalt-download.ts`
- Create: `services/video-worker/src/security/cobalt-download.test.ts`
- Create: `services/cobalt/Dockerfile`
- Create: `services/cobalt/docker-compose.test.yml`
- Create: `services/cobalt/README.md`
- Create: `services/cobalt/THIRD_PARTY_NOTICES.md`
- Modify: `render.yaml`

**Interfaces:**
- Produces `downloadFromCobalt(input, signal): Promise<DownloadedSource>`.

- [ ] **Step 1: Write contract and security tests**

Mock `POST /` responses for `tunnel`, `redirect`, `picker`, `error`, malformed JSON, timeout, cancellation, private-network redirect, oversized stream, unknown content type, and circuit-open state.

- [ ] **Step 2: Run and confirm failure**

Run: `npm --prefix services/video-worker test -- cobalt-download.test.ts`

Expected: FAIL because the adapter is absent.

- [ ] **Step 3: Implement the adapter**

Send `Accept: application/json`, `Content-Type: application/json`, and `Authorization: Api-Key <secret>` to `POST /`. Accept only `tunnel` and `redirect`; feed returned URLs through `downloadDirectMedia`; scan/probe before asset creation; cut a requested section with FFmpeg only after bounded retrieval.

- [ ] **Step 4: Add immutable deployment material**

Pin an official Cobalt image by version or digest, configure API-key authentication, document AGPL source/notice obligations, and make the Render service optional. Do not use an unofficial public API.

- [ ] **Step 5: Run tests/smoke test and commit**

Run: `npm --prefix services/video-worker test -- cobalt-download.test.ts`

Expected: PASS.

If Docker exists, run: `docker compose -f services/cobalt/docker-compose.test.yml up --abort-on-container-exit`

Run: `git add services/video-worker/src/security/cobalt-download* services/cobalt render.yaml && git commit -m "feat: add optional Cobalt acquisition adapter"`

### Task 5: Execute and audit one acquisition path per lease

**Files:**
- Create: `services/video-worker/src/tasks/youtube-acquisition.ts`
- Create: `services/video-worker/src/tasks/youtube-acquisition.test.ts`
- Modify: `services/video-worker/src/tasks/handlers.ts`
- Modify: `services/video-worker/src/queue/repository.ts`
- Modify: `services/video-worker/src/queue/retry.ts`
- Modify: `services/video-worker/src/security/youtube-download.ts`
- Modify: `supabase/migrations/20260719120000_free_youtube_acquisition_relay.sql`

**Interfaces:**
- Produces `executeYouTubeAcquisitionAttempt(task, job, directory, signal)`.
- Consumes `nextAcquisitionAttempt`, `downloadYouTubeMedia`, and `downloadFromCobalt`.

- [ ] **Step 1: Write orchestration tests**

Cover attempt persistence before network access, success completion, sanitized failure, provider challenge scheduling the next path, terminal restriction skipping rotation, cancellation, identical-path avoidance, local-relay creation after cloud exhaustion, and authorised-source fallback when relay is disabled.

- [ ] **Step 2: Implement repository RPC wrappers**

Add typed wrappers for recording/finishing attempts and creating relay requests. Fail closed when the RPC transition loses its lease.

- [ ] **Step 3: Extract the large handler path**

Move YouTube acquisition to the focused module without changing the downstream asset path, virus scan, FFprobe validation, checksum, attachment, or validation-child task.

- [ ] **Step 4: Make retry messages tier-aware and safe**

Persist safe source tier/member/strategy labels; never persist raw stderr, cookies, proxy URLs, or credentials. Do not consume task retries while waiting for an offline helper.

- [ ] **Step 5: Run focused and full worker tests, then commit**

Run: `npm --prefix services/video-worker test -- youtube-acquisition.test.ts youtube-download.test.ts youtube-proxy.test.ts`

Expected: PASS.

Run: `npm --prefix services/video-worker test`

Expected: all worker tests pass.

Run: `git add services/video-worker/src supabase/migrations/20260719120000_free_youtube_acquisition_relay.sql && git commit -m "feat: orchestrate audited youtube acquisition tiers"`

### Task 6: Add signed relay pairing and callback APIs

**Files:**
- Create: `src/services/acquisition/relay-token.server.ts`
- Create: `src/services/acquisition/relay-token.server.test.ts`
- Create: `src/services/acquisition/relay.server.ts`
- Create: `src/services/acquisition/relay.server.test.ts`
- Create: `src/routes/api.acquisition.relay.$action.ts`
- Modify: `src/config/env.server.ts`

**Interfaces:**
- Produces `signRelayCapability`, `verifyRelayCapability`, `hashRelaySecret`, pairing server functions, and authenticated callback actions `pair`, `lease`, `heartbeat`, `progress`, `complete`, and `fail`.

- [ ] **Step 1: Write token tests**

Cover signature tampering, issuer/audience, expiry, future issue time, wrong action, wrong job/device/workspace, replayed nonce, key rotation identifier, and constant-time hash verification.

- [ ] **Step 2: Implement token primitives**

Use HMAC-SHA-256 with a dedicated 32-byte-minimum secret. Return compact base64url payload/signature envelopes and persist only SHA-256/HMAC hashes of opaque credentials.

- [ ] **Step 3: Write server/API tests**

Cover unauthenticated pairing, expired code, revoked device, cross-workspace lease, concurrent lease, heartbeat extension ceiling, callback body limit, duplicate completion, late completion after cancel, unexpected object path, oversized object, checksum mismatch, and fast callback acknowledgement.

- [ ] **Step 4: Implement pairing and callbacks**

Server functions use the authenticated Supabase session; helper callbacks use device credentials plus single-job capability. Completion queues `validate_source` transactionally and deletes rejected/orphaned objects.

- [ ] **Step 5: Generate the route and run tests**

Run: `npm run test -- relay-token.server.test.ts relay.server.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: TanStack regenerates the route tree and build succeeds.

- [ ] **Step 6: Commit**

Run: `git add src/services/acquisition src/routes/api.acquisition.relay.\$action.ts src/config/env.server.ts src/routeTree.gen.ts && git commit -m "feat: add signed acquisition relay callbacks"`

### Task 7: Build the least-privilege local helper

**Files:**
- Create: `services/local-acquisition-helper/package.json`
- Create: `services/local-acquisition-helper/tsconfig.json`
- Create: `services/local-acquisition-helper/src/config.ts`
- Create: `services/local-acquisition-helper/src/client.ts`
- Create: `services/local-acquisition-helper/src/downloader.ts`
- Create: `services/local-acquisition-helper/src/credentials.ts`
- Create: `services/local-acquisition-helper/src/index.ts`
- Create: corresponding `*.test.ts` files
- Create: `services/local-acquisition-helper/README.md`
- Create: `services/local-acquisition-helper/THIRD_PARTY_NOTICES.md`
- Modify: root `package.json`

**Interfaces:**
- Produces CLI commands `pair`, `serve`, `status`, `revoke-local`, and `version`.

- [ ] **Step 1: Write client/downloader tests**

Cover pairing-code normalization, credential permissions, lease polling, heartbeat, progress throttling, cancellation abort, exact-section args, no-cookie default, explicit local cookie path, output-path containment, maximum bytes, checksum, upload retry, duplicate completion, redaction, and cleanup.

- [ ] **Step 2: Implement config and credential storage**

Use the OS credential store when an available maintained dependency supports the platform; otherwise create a mode-0600 configuration file only after explicit CLI acknowledgement. Never print secrets.

- [ ] **Step 3: Implement the helper client**

Poll/long-poll one scoped relay lease, heartbeat before half the lease duration, honor server cancellation, and make completion/failure callbacks idempotent.

- [ ] **Step 4: Implement local yt-dlp acquisition**

Reuse the worker's version/argument policy, download only the validated section when present, pass cookies only from an explicitly supplied local path, redact child-process errors, scan output bounds, and delete temp files after upload/abort.

- [ ] **Step 5: Add scripts and docs**

Root scripts: `helper:typecheck`, `helper:test`, and `helper:build`. Document Windows/macOS/Linux pairing, startup, revocation, cookie risk, and the fact that the helper must remain online.

- [ ] **Step 6: Run helper checks and commit**

Run: `npm --prefix services/local-acquisition-helper run typecheck && npm --prefix services/local-acquisition-helper test && npm --prefix services/local-acquisition-helper run build`

Expected: all pass.

Run: `git add services/local-acquisition-helper package.json && git commit -m "feat: add residential acquisition helper"`

### Task 8: Add durable realtime acquisition toasts

**Files:**
- Create: `src/components/app/job-toast-coordinator.tsx`
- Create: `src/components/app/job-toast-coordinator.test.tsx`
- Modify: `src/components/app/layout.tsx`
- Modify: `src/services/clipping/server.ts`

**Interfaces:**
- Produces `JobToastCoordinator({ userId, workspaceId })` and pure `toastForProcessingEvent(event)`.

- [ ] **Step 1: Write toast tests**

Cover relevant event mapping, irrelevant-progress suppression, event-ID deduplication, progress toast replacement, Strict Mode remount, realtime duplicate, reconnect reconciliation, bounded local-storage history, multi-tab leader election fallback, reduced motion, and no secret-like text propagation.

- [ ] **Step 2: Implement pure event mapping**

Map protected retry, cloud blocked, helper online/downloading/uploading, source received, clip ready, and action-required states to stable toast IDs and success/info/warning/error variants.

- [ ] **Step 3: Implement coordinator and reconciliation**

Subscribe to workspace processing events and job status, fetch events newer than the last seen timestamp after reconnect, store at most 500 event IDs, update progress by stable toast ID, and defer to the durable timeline for detail.

- [ ] **Step 4: Mount once in the authenticated shell**

Remove overlapping job/export completion subscriptions from `AppLayout` or route them through the coordinator to prevent duplicate notifications.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test -- job-toast-coordinator.test.tsx`

Expected: PASS.

Run: `git add src/components/app src/services/clipping/server.ts && git commit -m "feat: notify acquisition progress with durable toasts"`

### Task 9: Add relay recovery and expanded health UI

**Files:**
- Create: `src/components/youtube-clipper/local-relay-recovery.tsx`
- Create: `src/components/youtube-clipper/local-relay-recovery.test.tsx`
- Modify: `src/components/youtube-clipper/job-progress.tsx`
- Modify: `src/components/dashboard/WorkerEgressBadge.tsx`
- Modify: `src/components/dashboard/WorkerEgressBadge.test.tsx`
- Modify: `src/services/worker/server.ts`
- Modify: `src/services/worker/server.test.ts`

**Interfaces:**
- Consumes relay server functions and sanitized pool health.

- [ ] **Step 1: Write responsive/accessibility tests**

Cover paired-online, paired-offline, unpaired setup, active download, upload, expired request, cancelled job, helper upgrade, local-cookie warning, sanitized health counts, keyboard actions, screen-reader labels, and no horizontal overflow classes at 360px.

- [ ] **Step 2: Implement sanitized health mapping**

Return configured/healthy/unique counts and helper/Cobalt enabled states only. Keep raw addresses, URLs, and credentials server-side.

- [ ] **Step 3: Implement relay recovery UI**

Offer `Continue on this device`, pairing code/instructions, device status/revoke, existing upload/direct-link options, and explicit local-cookie risk. Do not imply OAuth enables downloads.

- [ ] **Step 4: Integrate into job progress**

Show the component for awaiting relay/action-required states while preserving `AuthorisedSourceRecovery`. Display source tier and WARP member index in the durable event timeline.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test -- local-relay-recovery.test.tsx WorkerEgressBadge.test.tsx worker/server.test.ts`

Expected: PASS.

Run: `git add src/components/youtube-clipper src/components/dashboard src/services/worker && git commit -m "feat: add free device recovery experience"`

### Task 10: Documentation, full verification, and deployment

**Files:**
- Modify: `docs/video-worker.md`
- Modify: `docs/youtube-clipper.md`
- Modify: `services/video-worker/warp/README.md`
- Create: `docs/superpowers/plans/2026-07-19-free-youtube-acquisition-relay-worklog.md`
- Modify: `.env.example`
- Modify: `render.yaml`

**Interfaces:**
- Documents the exact operational chain, feature flags, callback security, local helper, and residual risks.

- [ ] **Step 1: Update docs and worklog**

Document measured WARP uniqueness, optional Cobalt, free local relay, cookie-local-only rule, OAuth separation, event/toast flow, environment precedence, troubleshooting, revocation, deployment ordering, and the continued authorised-source fallback.

- [ ] **Step 2: Run the complete local matrix**

Run:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm --prefix services/video-worker run typecheck
npm --prefix services/video-worker test
npm --prefix services/video-worker run build
npm --prefix services/local-acquisition-helper run typecheck
npm --prefix services/local-acquisition-helper test
npm --prefix services/local-acquisition-helper run build
```

Expected: every command exits 0.

- [ ] **Step 3: Run integration and browser verification**

Run Supabase reset/integration tests, relevant Playwright flows, and 360px screenshots. Verify pairing, revoked device, blocked cloud transition, helper progress, browser navigation/reconnect, toast dedupe, source resume, clip completion, and no horizontal overflow.

- [ ] **Step 4: Deploy in safe order**

Deploy database migration, then server/app endpoints behind disabled flags, then worker, then optional Cobalt, then enable local relay. Verify authenticated health and rollback compatibility after every stage.

- [ ] **Step 5: Run production end-to-end evidence**

Retry a previously WARP-blocked authorised video. Confirm either a distinct measured WARP path or paired helper succeeds; inspect sanitized attempt events; confirm validation, clip render, export download, toast reconciliation, cancellation cleanup, and mobile UI.

- [ ] **Step 6: Commit verification artifacts and push**

Run: `git add docs .env.example render.yaml && git commit -m "docs: verify free youtube acquisition relay"`

Run: `git push -u origin codex/youtube-free-acquisition-relay`

Expected: branch push succeeds without history rewriting.
