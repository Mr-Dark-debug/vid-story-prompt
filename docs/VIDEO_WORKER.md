# Video worker

`services/video-worker` is a Node.js 22 Docker service with FFmpeg, FFprobe and licensed Liberation fonts. It claims one leased task per container, heartbeats, honours cancellation and cleans its isolated temporary directory in `finally`.

Implemented handlers validate media, securely download direct sources, acquire rights-attested YouTube sources, build proxies, extract/chunk audio, transcribe with Groq/OpenAI fallback, merge overlap words, plan candidates through OpenRouter, deduplicate/select diverse moments, render previews/final exports, create SRT/VTT/ASS and delete expired assets.

The image pins yt-dlp `2026.07.04` as both the verified CLI used by startup probes and the Python package used by the internal acquisition engine. `YTDLP_TIMEOUT_MS` defaults to ten minutes. The loopback FastAPI engine embeds `yt_dlp.YoutubeDL`, enables Node 22 for the bundled YouTube challenge solver, disables cookies, cache, playlists, live video, partial files and unbounded retries, and applies the global source-size bound plus the job's reserved-duration and plan-height bounds. The Node handler polls job cancellation, cancels the Python request, and cannot move a cancelled job back into validation.

## YouTube egress

YouTube acquisition passes one server-only proxy selection into the embedded Python yt-dlp options. Precedence is:

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
4. Existing same-job authorised-source upload, connector import, or owner-controlled HTTPS URL recovery.

Every network attempt is inserted into `source_acquisition_attempts` before it starts and finished with a sanitized result. `processing_events` exposes only the source tier, strategy, and pool member index—never proxy URLs, exact egress IPs, credentials, cookies, filenames, or raw provider stderr. Interrupted running attempts are superseded before planning resumes, so a task never repeats an identical `(egress identity, client strategy)` path.

The WARP pool measures every registration through Cloudflare trace, HMAC-fingerprints the actual egress address, and deduplicates registrations that happen to receive the same address. The free Render Blueprint uses two embedded registrations to respect the free worker's process and memory limits. The standalone sidecar remains available for paid or self-hosted deployments. Pool failure leaves the worker ready for uploads, rendering, Cobalt, and authorised-source recovery, while `/health/proxy` accurately reports blocked egress; direct production download remains disabled.

Cobalt is optional extractor diversity, not a guaranteed network bypass. The official image, API-key wrapper, AGPL notice, Compose contract test, and optional Render example live in `services/cobalt/`. The hosted `api.cobalt.tools` endpoint is not used. See the [current Cobalt API documentation](https://github.com/imputnet/cobalt/blob/main/docs/api.md) and [instance protection guide](https://github.com/imputnet/cobalt/blob/main/docs/protect-an-instance.md).

## Internal Python acquisition API

`services/video-worker/python-acquisition` is packaged into the existing Render image and bound to `127.0.0.1:8090`. It is not a public downloader and is not deployed on Vercel. Vercel Functions are an unsuitable media plane because request/response bodies are limited and invocation lifetime is bounded; a separate free Render service would introduce another cold start and consume the same monthly free-instance pool.

The Node worker submits an authenticated `POST /v1/downloads` and receives HTTP 202, then polls the status resource while maintaining the durable Supabase task heartbeat. Completed responses contain local artifact metadata, never media bytes. Node revalidates path containment, exact byte size, extension, malware/media properties, checksum and immutable Storage path before uploading directly to the private Supabase `source-media` bucket.

FastAPI accepts only canonical video IDs, an allowlisted container, the server-derived 720p/1080p/2160p plan cap, bounded duration and optional exact source section. It writes only beneath `WORKER_TEMP_ROOT`. `start.sh` generates separate per-container API and webhook secrets when absent, waits for Python health, and fails container startup if the process cannot become healthy. Signed callbacks are raw-body verified, schema and size bounded, mapped to fixed product copy, and inserted through a replay-safe service-role RPC before Supabase Realtime updates the UI.

The local-device relay and its pairing API were retired on 2026-07-30. Historical schema/status values remain readable for already-created rows, but no planner, route, UI, environment flag, or helper executable can create new relay requests.
