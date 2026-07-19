# Video worker

`services/video-worker` is a Node.js 22 Docker service with FFmpeg, FFprobe and licensed Liberation fonts. It claims one leased task per container, heartbeats, honours cancellation and cleans its isolated temporary directory in `finally`.

Implemented handlers validate media, securely download direct sources, acquire rights-attested YouTube sources, build proxies, extract/chunk audio, transcribe with Groq/OpenAI fallback, merge overlap words, plan candidates through OpenRouter, deduplicate/select diverse moments, render previews/final exports, create SRT/VTT/ASS and delete expired assets.

The image pins yt-dlp `2026.07.04` and verifies the upstream SHA-256 during its Docker build. `YTDLP_PATH` defaults to `yt-dlp` and `YTDLP_TIMEOUT_MS` defaults to ten minutes. The command builder explicitly enables the image's Node 22 runtime for yt-dlp's bundled YouTube challenge solver, disables cookies, config files, cache, playlists, live video, partial files and unbounded retries, and applies the global source-size bound plus the job's reserved-duration bound. The handler polls job cancellation while yt-dlp runs and cannot move a cancelled job back into validation.

## YouTube egress

YouTube acquisition uses one server-only proxy selection for both yt-dlp's `--proxy` option and the subprocess `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, and lowercase variables. Precedence is:

1. `YTDLP_PROXY_URL` — operator override, including an approved authenticated proxy.
2. `WARP_PROXY_URL` — explicit WARP HTTP proxy URL.
3. `WARP_PROXY_HOST` plus `WARP_PROXY_PORT` — Render private-service wiring.
4. direct egress only in local development. Production planning never silently falls back to direct egress.

The production Docker image adds a loopback-only embedded WARP fallback for
workspaces where Render cannot provision a private service yet. It starts only
when the first three settings are absent, binds its proxy to `127.0.0.1`, and
fails container startup if protected egress cannot be established. A configured
operator proxy or private sidecar always wins, so migrating to the persistent
sidecar requires no application change.

A job with `forceProxy=true` fails closed if no proxy exists. A configured proxy that cannot pass the Cloudflare trace check also fails readiness; the worker never silently falls back to direct egress.

On startup the worker checks Cloudflare trace and, when `YTDLP_STARTUP_PROBE=true`, runs a bounded yt-dlp format probe for the controlled public test video. The protected `GET /health/proxy` endpoint requires the worker bearer secret. It returns operator diagnostics including egress/WARP state, but the TanStack server maps that response to a sanitized health status before browser code sees it. Proxy URLs, credentials, and egress IPs never enter browser responses.

`services/video-worker/warp` builds a pinned MIT-licensed user-space WARP client that needs no `NET_ADMIN` capability and exposes HTTP CONNECT on private port 8080. A separate Render health listener returns success only when the proxied Cloudflare trace contains `warp=on` or `warp=plus`. Registration state is persisted. WARP access and the proxy implementation are free, but Render private services require paid compute.

`--download-sections` with FFmpeg is used only when a task contains an exact validated `sourceSection`. The current AI clipping flow discovers candidate ranges after transcription, so its initial acquisition still needs the complete source. Vidrial does not claim partial-transfer savings unless `sectionApplied=true` is recorded by the worker.

Use at least 4 vCPU, 8 GB RAM and 20 GB temporary disk per render container. Horizontal scaling is safe because database leases and idempotency keys are authoritative.

The worker also polls `connector_tasks`. Provider imports use official bearer-authorised endpoints, never browser-supplied headers. Transfers are streamed with the global maximum-size limit, heartbeat byte progress, MIME checks, checksum, FFprobe validation, immutable paths and `finally` cleanup. Configure `CONNECTOR_TOKEN_ENCRYPTION_KEY` identically in the web and worker environments.

## YouTube acquisition resilience

YouTube media acquisition is a bounded, audited source-selection problem; FFmpeg clipping starts only after a source is isolated. Production never silently falls back to direct datacenter egress.

The precedence chain is:

1. `YTDLP_PROXY_URL`, when the operator supplies a server-side override.
2. Each healthy, unique WARP egress identity from `WARP_POOL_URLS` (or the embedded pool), across the existing bounded player-client strategies.
3. One optional self-hosted Cobalt request when `COBALT_API_URL` is configured.
4. The free paired local helper, explicitly started by the user after cloud exhaustion.
5. Existing same-job authorised-source upload, connector import, or owner-controlled HTTPS URL recovery.

Every network attempt is inserted into `source_acquisition_attempts` before it starts and finished with a sanitized result. `processing_events` exposes only the source tier, strategy, and pool member index—never proxy URLs, exact egress IPs, credentials, cookies, filenames, or raw provider stderr. Interrupted running attempts are superseded before planning resumes, so a task never repeats an identical `(egress identity, client strategy)` path.

The WARP pool measures every registration through Cloudflare trace, HMAC-fingerprints the actual egress address, and deduplicates registrations that happen to receive the same address. The free Render Blueprint uses two embedded registrations to respect the free worker's process and memory limits. The standalone sidecar remains available for paid or self-hosted deployments. Pool failure leaves the worker ready for uploads, rendering, Cobalt, and local recovery, while `/health/proxy` accurately reports blocked egress; direct production download remains disabled.

Cobalt is optional extractor diversity, not a guaranteed network bypass. The official image, API-key wrapper, AGPL notice, Compose contract test, and optional Render example live in `services/cobalt/`. The hosted `api.cobalt.tools` endpoint is not used. See the [current Cobalt API documentation](https://github.com/imputnet/cobalt/blob/main/docs/api.md) and [instance protection guide](https://github.com/imputnet/cobalt/blob/main/docs/protect-an-instance.md).

The local helper lives in `services/acquisition-helper/`. It leases one device-scoped request, heartbeats, uses exact `--download-sections` bounds, uploads through a short-lived signed Storage URL, completes through an idempotent callback, and deletes temporary media. Default operation is cookie-free. An explicit `--cookies` path remains on the local device and is never sent to Vidrial. Cookies are full account credentials and authenticated acquisition can trigger account restrictions. Private, paid, DRM, region- and age-restricted content is unsupported.

Required web/server settings to enable the helper are `LOCAL_RELAY_ENABLED=true`, a dedicated 32+ character `LOCAL_RELAY_SIGNING_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the canonical `PUBLIC_APP_URL`. Keep the signing key distinct from OAuth and connector encryption keys. The worker receives only the feature flag for sanitized health reporting; helper callbacks terminate at the app.
