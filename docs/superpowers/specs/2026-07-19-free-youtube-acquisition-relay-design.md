# Free YouTube Acquisition Relay Design

## Status

Approved by the user on 2026-07-19. The user selected a free, production-oriented design and explicitly requested asynchronous execution, signed callbacks, and user-facing toast notifications. This specification replaces the unverified assumptions in the supplied multi-source fallback brief with an architecture that keeps the existing protected cloud path while adding a residential recovery path that does not upload Google session credentials to Vidrial.

## Objective

Maximize automatic and assisted success for authorised YouTube clipping without adding a paid dependency or weakening Vidrial's security and queue guarantees:

- retain yt-dlp, exact-section support, player-client rotation, embedded WARP, `WARP_PROXY_URL`, and the `YTDLP_PROXY_URL` operator override;
- rotate only healthy, actually distinct WARP egress members instead of assuming registrations imply distinct addresses;
- add an optional self-hosted Cobalt adapter as an extractor-level second opinion, while treating it as another datacenter path rather than a guaranteed IP bypass;
- add a free local acquisition helper that can use the user's residential connection when every cloud path is blocked;
- keep browser cookies local to the user's device and never upload them to Vidrial;
- persist every acquisition transition and make retries, callbacks, uploads, cancellation, and cleanup idempotent;
- drive browser toasts from persisted realtime events, not from ephemeral worker responses;
- preserve the existing same-job authorised source upload/direct-link recovery as the final safety net.

The design does not promise universal YouTube retrieval. Private, members-only, paid, age-restricted, region-restricted, removed, live, DRM-protected, or otherwise inaccessible media remains unsupported unless the user supplies an authorised original source that passes the normal worker validation.

## Evidence and corrected assumptions

The current production worker has already demonstrated successful embedded-WARP startup and proxy health, but two previously failing videos still returned `provider_auth_challenge` through that WARP egress. The failure remains upstream of FFmpeg, transcription, planning, rendering, and export.

The supplied brief contains claims that cannot be used as production invariants:

- Cloudflare's default WARP/Gateway egress uses shared address ranges and keeps a user on an egress address for connection stability. Separate registrations can still converge on the same public address. Pool membership must therefore be based on measured, unique egress addresses.
- Render services in a region share outbound IP ranges. A Cobalt service in the same Render region is extractor diversity, not independent network diversity.
- Render Free web services cannot receive private-network traffic and Render documents that Free instances are not intended for production. A free Cobalt deployment must be optional and publicly reachable behind an API key, or hosted by the operator elsewhere; it cannot be required for core correctness.
- Cobalt has no supported public application API. Official hosted instances are bot-protected and not intended for unauthorised programmatic use.
- Cobalt uses YouTube.js. It offers a different extraction implementation from yt-dlp, but it does not fix an egress address already blocked by YouTube.
- YouTube cookies are bearer-session credentials. yt-dlp warns that authenticated use can temporarily or permanently ban the account, that cookies rotate, and that browser exports can include cookies for unrelated sites. Vidrial will not accept or store a Google cookie jar.
- Tornado API currently starts at hundreds of dollars per month and uses an asynchronous job API. It is excluded by the user's free-only decision.

## Considered approaches

### Cloud-only free fallbacks

Run yt-dlp, multiple WARP registrations, YouTube.js/Cobalt, and uploaded cookies entirely in hosted infrastructure. This is automatic and free at the software layer, but all extractors remain exposed to cloud-IP blocking. Uploading cookies also turns Vidrial into a custodian of Google account sessions. This approach is not selected as the complete solution.

### Paid managed residential acquisition

Use a managed provider or residential proxy service after protected cloud attempts. This is the simplest cloud-only reliability improvement, but current reputable offerings are not free. This remains compatible through the existing server-only `YTDLP_PROXY_URL` override but is not a shipped dependency.

### Protected cloud acquisition plus local residential relay (selected)

Try bounded cloud paths first. If they fail, offer a one-click handoff to an open-source Vidrial helper on the user's machine. The helper leases only that job, downloads the requested authorised media through the user's own connection, and uploads it directly to Supabase using a short-lived capability. The cloud worker then resumes the unchanged job from source validation.

This is the only zero-cost option that changes the network class from cloud/WARP to residential. It also permits optional local cookie use without disclosing the cookie jar to Vidrial.

## Architecture

### Acquisition state model

The existing `download_youtube_source` task remains the parent queue unit, but acquisition progress is no longer inferred from `attempt % strategyCount`. A new `source_acquisition_attempts` table records one row per bounded path attempt:

- `id uuid primary key`;
- `clip_job_id uuid` and `job_task_id uuid` with cascading ownership through the job;
- `ordinal integer` unique per job task;
- `source_tier text` constrained to `operator_proxy`, `warp`, `cobalt`, `local_relay`, or `authorised_source`;
- `strategy text` nullable for non-yt-dlp tiers;
- `pool_member_id text` nullable, opaque, and free of proxy URLs or credentials;
- `egress_fingerprint text` nullable and server-only; stores a keyed hash, not a raw IP;
- `status text` constrained to `queued`, `leased`, `running`, `awaiting_callback`, `succeeded`, `failed`, `cancelled`, or `superseded`;
- safe `error_code` and bounded `error_message`;
- `started_at`, `heartbeat_at`, `completed_at`, and `created_at` timestamps;
- a unique idempotency key.

RLS allows workspace members to read a sanitized projection through the existing job service. Direct browser insert, update, or delete is prohibited. Service-role RPCs perform state transitions under row locks.

`processing_events` remains the user-visible audit stream. It gains `source_tier`, `pool_member_index`, and `acquisition_attempt_id` fields. The existing `proxy_tier` field remains for backward compatibility and is populated only for actual proxy egress. Dynamic pool names are not added to a growing check constraint; the tier stays `warp` and the member index is stored separately.

### Deterministic attempt planning

A pure planner receives configuration, measured health, prior terminal attempts, job input, and whether the local relay is available. It returns the next untried path. Precedence is:

1. `YTDLP_PROXY_URL`, when configured. This operator override remains highest priority and is attempted once per relevant client strategy, not repeated later as a duplicate tier.
2. Unique healthy WARP members with a bounded client-strategy matrix. Pool and client rotation are independent dimensions. The planner avoids retrying an identical `(egress fingerprint, strategy)` pair.
3. Cobalt when explicitly configured and healthy. Cobalt is attempted once per configured instance, with a strict timeout and circuit breaker.
4. Local residential relay when the user has an active helper or elects to continue on the device.
5. Existing `awaiting_authorised_source` recovery.

Development may try direct egress first. Production never silently falls back to direct egress after a configured protected route fails.

Non-retryable classifications such as removed, private, age-restricted, region-restricted, DRM-protected, invalid ID, live media, or duration entitlement failure skip network rotation and move directly to clear recovery guidance. Cancellation supersedes all queued or awaiting attempts.

### WARP pool

The embedded WARP launcher and standalone sidecar gain configurable pool support:

- `WARP_POOL_SIZE` controls registrations, with conservative resource limits and a documented maximum;
- each process has a distinct data directory, listener port, process ID, and health state;
- registration identities persist when persistent storage is available and are not regenerated on normal restarts;
- startup probes Cloudflare trace through every listener;
- the pool groups members by a keyed hash of the measured egress IP and exposes only unique healthy groups to the planner;
- duplicate egress addresses remain visible to operators as reduced effective capacity but are not retried as if they were independent;
- failed members are quarantined with exponential health-probe backoff;
- startup succeeds when the configured minimum healthy unique-member count is met, otherwise readiness is degraded or blocked according to configuration;
- proxy credentials and raw addresses never enter product events or browser responses.

The public worker health projection reports `{ configuredMembers, healthyMembers, uniqueEgressMembers, status, checkedAt }`. Operator logs may show a redacted address prefix; browser responses do not.

The free Render deployment continues using embedded WARP because a private sidecar requires paid compute. The standalone sidecar remains supported for paid or self-hosted deployments. Pool size defaults must respect the free worker's memory and process limits; health-based functionality is more important than forcing three simultaneous processes.

### Cobalt adapter

The Cobalt integration is optional and disabled when `COBALT_API_URL` is absent. It uses a version-pinned official image or immutable commit, never `latest`. The adapter:

- validates the configured base URL at startup;
- sends the API key in the documented `Authorization: Api-Key` header;
- posts the current Cobalt request schema to `POST /`, not the obsolete `/api/json` contract;
- accepts only documented `tunnel` or `redirect` responses for a single video;
- rejects `picker`, unexpected hosts, unsupported schemes, private/reserved redirect destinations, and malformed content;
- downloads through the existing bounded direct-media downloader, preserving DNS, redirect, timeout, and maximum-size controls;
- runs FFprobe and virus scanning before creating a media asset;
- applies the requested section with FFmpeg when Cobalt cannot perform a source-side range download;
- uses a circuit breaker after repeated connectivity or provider failures;
- records only safe status/error codes.

An optional free Cobalt web service may be deployed in a different region and protected with an API key, but it is never described as production guaranteed. The worker's normal source-recovery behavior remains correct if Cobalt is sleeping, unreachable, blocked, or absent. AGPL notices, source link, exact image version, and modification status are documented. Cobalt code is not copied into the proprietary worker.

### Local acquisition helper

`services/local-acquisition-helper/` is an open-source, cross-platform Node/Bun command-line service distributed from this repository. It reuses the worker's validated yt-dlp/FFmpeg version policy but has no Supabase service role or workspace-wide credentials.

The user pairs the helper with a one-time browser flow:

1. The authenticated app requests a random pairing challenge with a short expiry and displays a code/deep link.
2. The helper exchanges that challenge for a device identity and refreshable device credential scoped to the user and workspace.
3. The credential is stored using the operating system credential store when available. Plaintext fallback requires explicit user acknowledgement and restrictive file permissions.
4. The user can revoke a device from Vidrial settings at any time.

For a blocked job, the app creates a single-use relay capability containing only job ID, video ID, expected duration, optional exact section, allowed upload path, maximum bytes, expiry, and nonce. The capability is signed server-side and stored hashed. It never contains a Supabase service key.

The helper leases the relay request asynchronously, heartbeats while active, and downloads through the local network. Default mode remains cookie-free. If authentication is genuinely necessary and the user explicitly opts in, browser cookies are read locally and passed only to the local yt-dlp process. Cookie contents, cookie names, browser profile paths, and authenticated yt-dlp stderr are never sent to Vidrial.

The helper uploads the result directly to a job-specific immutable Storage path using a short-lived signed upload or TUS capability. Completion calls an idempotent server endpoint with object path, byte count, format, and checksum. The server verifies:

- capability signature, nonce, expiry, and non-revocation;
- authenticated device ownership and workspace membership;
- expected immutable object-path prefix;
- object existence and maximum size;
- checksum and single-use completion;
- that the job is still awaiting this relay and is not cancelled or expired.

The cloud worker then leases a normal `validate_source` task. FFprobe and virus scanning remain authoritative; the helper cannot bypass entitlement, duration, stream, watermark, or rendering rules.

If the helper disconnects, the lease expires and can be reclaimed by the same device. A different paired device requires an explicit browser action. Duplicate completion is idempotent. Late completion after cancellation deletes the orphaned object. Helper upgrade mismatch returns a clear upgrade-required state rather than looping.

### Webhooks, realtime events, and toasts

Webhooks are server-to-server inputs; browsers do not receive webhooks directly. All webhook handlers:

- require provider-specific HMAC or single-use capability verification;
- enforce timestamp skew and replay protection;
- store a provider event ID under a unique constraint;
- acknowledge duplicates without repeating transitions;
- perform bounded parsing before any network fetch;
- enqueue work and return quickly rather than downloading media inside the request;
- never log request bodies or secrets.

The local helper uses signed callbacks for lease, progress, completion, and failure. Cobalt remains synchronous at the API-contract level unless a future documented callback mode is enabled; its network work runs asynchronously inside the worker queue.

Supabase Realtime subscriptions on `processing_events`, job status, and relay request state drive the browser. A shared toast coordinator is mounted inside the authenticated app shell so navigation does not discard active notifications. It shows only actionable state boundaries:

- protected acquisition started;
- another distinct egress path is being attempted;
- cloud acquisition blocked and local relay is available;
- local helper connected, downloading, or uploading;
- source received and cloud processing resumed;
- clip or export ready;
- user action required or terminal failure.

Toast IDs are derived from persisted event IDs. The coordinator keeps a bounded per-user seen set in local storage and reconciles with the latest server events after reconnect, preventing duplicate toasts across realtime reconnection, page navigation, Strict Mode remounts, and webhook retries. Progress changes update an existing toast instead of creating new toasts. Every transient toast has an equivalent durable entry in the job timeline. Reduced-motion, screen-reader announcements, focus handling, and 360px layouts are required.

### User experience

The clipping wizard continues to show worker egress health, now with effective unique WARP capacity and optional Cobalt/local-helper availability. It does not expose raw IP addresses or internal URLs.

When cloud acquisition is exhausted, the job page offers:

- **Continue on this device** when a paired helper is online;
- **Set up free device helper** with operating-system-specific installation and pairing instructions;
- the existing authorised upload and owner-controlled direct-link options.

Cookie use is an advanced local-helper option, disabled by default. The UI states that cookies are full account-session credentials, can cause account restrictions, should be used only when necessary, and never leave the device. Vidrial does not recommend a particular browser extension without linking to current upstream yt-dlp guidance.

YouTube OAuth remains Data API-only and is never presented as download authentication.

### Configuration

New worker configuration is server-only:

- `WARP_POOL_SIZE`, `WARP_POOL_BASE_PORT`, and `WARP_POOL_MIN_HEALTHY`;
- `WARP_POOL_URLS` for external/self-hosted pools;
- `COBALT_API_URL`, `COBALT_API_KEY`, and `COBALT_REQUEST_TIMEOUT_MS`;
- `LOCAL_RELAY_ENABLED` and relay lease/expiry limits;
- a dedicated `LOCAL_RELAY_SIGNING_KEY`, separate from OAuth token encryption;
- webhook timestamp and body-size limits.

No UI attempts to mutate Render environment variables. Operator configuration is environment-managed; the browser may see only sanitized enabled/disabled health.

## Error handling and edge cases

- Duplicate WARP egress: deduplicate by keyed fingerprint and do not consume retries on equivalent paths.
- Partial pool outage: use healthy unique members; expose degraded capacity; quarantine failing members.
- All pool members unhealthy: fail fast to Cobalt/local relay rather than direct production egress.
- Cobalt cold start or outage: bounded retry plus circuit breaker; never hold the queue lease indefinitely.
- Cobalt redirect abuse: apply the existing SSRF, DNS rebinding, redirect, size, and timeout protections.
- Provider response without exact length: stream under a hard byte counter and abort above the entitlement/configuration ceiling.
- Range request unavailable: download only when within maximum source limits, then cut locally; disclose that the upstream transfer was full.
- Relay device offline: retain the job in an action-required state without burning queue retries.
- Relay lease loss: abort local subprocess and upload; reclaim only after expiry.
- Browser closes: helper and server continue; realtime state and toasts reconcile on return.
- Job cancellation or expiry: revoke capabilities, abort active attempts, delete orphaned uploads, and suppress success toasts.
- Duplicate webhook/completion: unique provider ID and nonce make processing idempotent.
- Checksum mismatch or truncated upload: delete the object, fail the attempt safely, and allow a bounded retry.
- Helper version incompatibility: return `helper_upgrade_required` with a signed official download link.
- Cookie-required media: use local cookies only after explicit consent; restricted/paid/DRM content remains unsupported.
- Account or IP rate limiting: bounded delay and no automatic creation/rotation of user accounts or cookie identities.
- Multiple tabs: one toast coordinator leader per browser profile, with event-ID deduplication in every tab.
- Realtime outage: polling reconciliation provides eventual UI correctness.
- Secrets in errors: sanitize yt-dlp, Cobalt, helper, and HTTP failures before persistence.

## Security and privacy

- The browser retains only the Supabase publishable key and authenticated session.
- Service-role, proxy, Cobalt, signing, and webhook credentials remain server/worker-only.
- Relay capabilities are short-lived, job-scoped, single-use, signed, and stored hashed.
- Device credentials are revocable and cannot enumerate jobs outside their user/workspace scope.
- All object paths follow `{workspace_id}/{user_id}/{job_id}/{asset_type}/{uuid}.{extension}`.
- Raw IPs, proxy URLs, private video URLs, cookies, tokens, filenames, and transcripts are excluded from analytics and product events.
- Rights attestation remains mandatory. The helper does not broaden what content the user is authorised to process.
- Provider and helper dependencies are pinned, inventoried, and covered by third-party notices.

## Delivery sequence

1. Add the normalized acquisition-attempt schema, RPC transitions, sanitized projections, and generated types.
2. Refactor the worker into a pure attempt planner plus one-attempt executors while preserving current behavior.
3. Add measured/deduplicated WARP pool health and bounded rotation.
4. Add the optional Cobalt adapter and contract tests.
5. Add pairing, relay capability, device management, signed callback, and direct-upload server endpoints.
6. Build the local helper with heartbeat, cancellation, exact-section acquisition, checksum upload, local-only optional cookies, and packaging documentation.
7. Add the global toast coordinator, relay setup/status UI, durable timeline entries, and accessibility/mobile behavior.
8. Update health, environment examples, deployment blueprints, operational docs, security notices, and worklog.
9. Run unit, integration, Supabase, Playwright, Docker/Compose where available, build, and production verification.

Every phase must leave the existing cloud acquisition and authorised-source fallback operational. Feature flags gate Cobalt and local relay until their schema and endpoints are deployed.

## Verification

Automated coverage includes:

- proxy precedence and no production direct fallback;
- pool URL parsing, member startup, measured egress deduplication, partial outage, and quarantine recovery;
- deterministic planner exhaustion without duplicate path pairs;
- Cobalt current request/response contract, authentication, circuit breaker, SSRF rejection, size enforcement, and cancellation;
- relay pairing expiry, user/workspace isolation, credential revocation, capability scope, replay rejection, lease reclaim, heartbeat, cancellation, duplicate completion, late upload cleanup, and checksum mismatch;
- helper subprocess argument construction, local-only cookie handling, log redaction, exact sections, progress, abort, and cleanup;
- webhook signature, timestamp, body-size, provider-event idempotency, and fast acknowledgement;
- Realtime disconnect/reconnect, polling reconciliation, multiple tabs, Strict Mode, toast deduplication, progress replacement, accessibility, and 360px layout;
- preservation of existing authorised-source recovery, entitlement, watermark, RLS, and immutable-path behavior.

Required repository checks are:

- `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- `npm run build`;
- `npm --prefix services/video-worker run typecheck`;
- `npm --prefix services/video-worker test`;
- `npm --prefix services/video-worker run build`;
- local-helper typecheck, tests, build, and packaging checks;
- relevant Supabase reset/integration tests;
- relevant Playwright tests at desktop and 360px widths;
- WARP and Cobalt Compose smoke tests when Docker is available.

Production success is claimed only after the schema, app, worker, and enabled optional services are deployed; authenticated health is green or accurately degraded; a previously blocked job produces a clip through a distinct WARP path or the local residential helper; its acquisition events are visible; toast delivery reconciles after navigation/reconnect; and the output downloads successfully. Missing deployment credentials, unavailable Docker, third-party refusal, or provider blocking is reported rather than fabricated.

## Residual risks

- YouTube can block any cloud, WARP, Cobalt, account, or client path without notice.
- WARP registrations may share one egress address, and multiple processes consume scarce free-worker memory.
- Free Cobalt hosting can sleep, throttle, change egress, or be suspended; it is optional.
- The local helper requires installation and an online residential device.
- Local cookie use can restrict or ban a YouTube/Google account and is never automatic.
- Exact-section transfer savings depend on upstream range support.
- No free architecture can guarantee fully automatic cloud-only success; authorised upload remains necessary.
- `YTDLP_PROXY_URL` remains the operator escape hatch if a future paid or self-hosted residential proxy is approved.

## Sources

- https://github.com/yt-dlp/yt-dlp
- https://github.com/yt-dlp/yt-dlp/wiki/FAQ
- https://github.com/yt-dlp/yt-dlp/wiki/Extractors
- https://github.com/yt-dlp/yt-dlp/issues/3766
- https://github.com/LuanRT/YouTube.js
- https://github.com/imputnet/cobalt
- https://github.com/imputnet/cobalt/blob/main/docs/api.md
- https://github.com/imputnet/cobalt/blob/main/docs/run-an-instance.md
- https://github.com/imputnet/cobalt/issues/992
- https://developers.cloudflare.com/cloudflare-one/traffic-policies/egress-policies/
- https://render.com/docs/private-network
- https://render.com/docs/outbound-ip-addresses
- https://render.com/docs/free
- https://tornadoapi.io/pricing
- https://docs.tornadoapi.io/quickstart
