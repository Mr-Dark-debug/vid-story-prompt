# Video worker

`services/video-worker` is a Node.js 22 Docker service with FFmpeg, FFprobe and licensed Liberation fonts. It claims one leased task per container, heartbeats, honours cancellation and cleans its isolated temporary directory in `finally`.

Implemented handlers validate media, securely download direct sources, acquire rights-attested YouTube sources, build proxies, extract/chunk audio, transcribe with Groq/OpenAI fallback, merge overlap words, plan candidates through OpenRouter, deduplicate/select diverse moments, render previews/final exports, create SRT/VTT/ASS and delete expired assets.

The leased publishing queue also executes provider-specific, review-gated publication tasks for YouTube, Facebook Reels, Instagram Reels, TikTok Content Posting, and LinkedIn Videos/Posts. Provider access tokens are decrypted only inside server or worker code; derived Meta Page tokens are held only in task memory and are never persisted or returned to the browser.

Final renders parse the same version-2 immutable edit manifest shown by the editor. FFmpeg applies fit/fill/center/manual focal crop or a blurred background, user text overlays, gain/mute/fades, optional EBU R128 loudness normalization, server-derived watermarking, and libass captions. The manifest and source checksum are hashed into the exported asset metadata.

YouTube source objects larger than the storage provider's single-object allowance are written as immutable `STORAGE_UPLOAD_CHUNK_BYTES` parts plus a bounded private manifest at the canonical asset path. Workers validate the manifest path sequence and byte totals before reconstructing the source locally. This keeps large rights-attested sources durable across task boundaries without exposing a public URL or lowering plan-derived video quality.

The startup extractor check uses the configurable `YTDLP_PROBE_VIDEO_ID` and defaults to the Creative Commons Big Buck Bunny source used by the production acceptance test. A failure degrades only the diagnostic state; real jobs still use their own bounded strategy plan and persist the exact source-tier outcome.

Caption font presets use Debian's packaged Liberation Sans, Liberation Serif, and Liberation Mono families. Liberation fonts are freely redistributable metric-compatible fonts; the worker never downloads Museum Sans or another unlicensed face. `word_highlight` emits timed ASS karaoke tags from transcript word timings, `line_reveal` emits cumulative timed dialogue events, and `pop` uses bounded ASS fade/scale transforms. SRT and VTT sidecars use the same immutable cue boundaries.

The image pins yt-dlp `2026.08.19` as both the verified CLI used by startup probes and the Python package used by the internal acquisition engine. The Python `default` and `curl-cffi` extras install the matching EJS challenge package and supported networking runtime. The maintained default client path is tried first; the retired `android_vr` path is never selected because it now requires a GVS proof token and returned 403 for this workload. `YTDLP_TIMEOUT_MS` defaults to ten minutes. The loopback FastAPI engine embeds `yt_dlp.YoutubeDL`, enables Node 22 for EJS, disables cookies, cache, playlists, live video, partial files and unbounded retries, and applies the global source-size bound plus the job's reserved-duration and plan-height bounds. It also applies bounded pacing: `YTDLP_SLEEP_INTERVAL_SECONDS=5`, `YTDLP_MAX_SLEEP_INTERVAL_SECONDS=10`, and `YTDLP_REQUEST_SLEEP_INTERVAL_SECONDS=1`. The worker rejects download pacing below five seconds or maximum pacing above ten seconds. The Node handler polls job cancellation, cancels the Python request, and cannot move a cancelled job back into validation.

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

On startup the worker checks Cloudflare trace and, when `YTDLP_STARTUP_PROBE=true`, runs a bounded yt-dlp format probe for the controlled public test video. The protected `GET /health/proxy` endpoint requires the worker bearer secret. It reports sanitized readiness for `operator_proxy`, `protected_pool`, and `cobalt`, including configured/healthy/unique member counts and fixed reason codes such as `protected_pool_exhausted`, `cobalt_unreachable`, or `operator_proxy_unconfigured`. It deliberately omits proxy URLs, credentials, raw egress IPs, and provider stderr. The TanStack server further maps this to non-technical customer copy.

`services/video-worker/warp` builds a pinned MIT-licensed user-space WARP client that needs no `NET_ADMIN` capability and exposes HTTP CONNECT on private port 8080. A separate Render health listener returns success only when the proxied Cloudflare trace contains `warp=on` or `warp=plus`. Registration state is persisted. WARP access and the proxy implementation are free, but Render private services require paid compute.

`--download-sections` with FFmpeg is used only when a task contains an exact validated `sourceSection`. The current AI clipping flow discovers candidate ranges after transcription, so its initial acquisition still needs the complete source. Vidrial does not claim partial-transfer savings unless `sectionApplied=true` is recorded by the worker.

Use at least 4 vCPU, 8 GB RAM and 20 GB temporary disk per render container. Horizontal scaling is safe because database leases and idempotency keys are authoritative.

### Capability-routed residential acquisition

`claim_clip_task_for_capabilities` lets each worker declare a task allowlist and/or denylist without weakening task leases. `WORKER_TASK_INCLUDE_TYPES` and `WORKER_TASK_EXCLUDE_TYPES` are comma-separated server-only values; invalid names, duplicates, and overlap are rejected. The Render blueprint excludes `download_youtube_source` but continues to process all downstream media tasks. The Windows service in `services/video-worker/home-worker` includes only `download_youtube_source` and disables connector-task polling.

The Windows installer also supports `-TaskMode FullPipeline` as a deliberate zero-cost continuity mode when Render is suspended. In that mode the include list is empty (all clip tasks), connector polling remains disabled, and the same database leases/idempotency rules apply. Return it to `AcquisitionOnly` when the cloud worker recovers; do not operate multiple unrestricted home workers unintentionally.

The home worker is a limited current-user scheduled task. It uses a private Python virtual environment, repository FFmpeg/FFprobe binaries, loopback ports 18080/18090, cryptographically generated user-ACL secrets, and direct residential egress. It opens no inbound port and exposes no public downloader. `TRUST_DIRECT_EGRESS=true` is set only by this installer and only changes health labelling after the real startup yt-dlp probe succeeds; it does not bypass provider restrictions or enable direct production egress on Render.

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

### Operator proxy setup

`YTDLP_PROXY_URL` is the first production tier because a clean operator-controlled egress path is generally more durable than shared VPN/datacenter addresses. Configure it only on the worker, never Vercel or a `VITE_` variable. Accepted schemes are `http`, `https`, `socks5`, and `socks5h`; authenticated URLs are supported and must be stored as an encrypted host secret. Restart the worker, then call the bearer-protected `/health/proxy`. The expected result is `tiers.operator_proxy.state=ready`; the response never echoes the configured URL or its address.

If the endpoint reports `operator_proxy_blocked`, rotate or repair the operator-managed endpoint and redeploy. Removing `YTDLP_PROXY_URL` intentionally restores the protected-pool tier. Never work around a failed proxy by enabling direct production egress. Self-hosters should size request quotas for the documented bounded strategy count and retain the 5-10 second pacing defaults.

## Internal Python acquisition API

### September 2026 clipping reliability changes

New clipping jobs no longer enqueue a full-source preview proxy: clip review consumes rendered clip previews, not that large auxiliary object. The old task handler remains for compatibility. Groq retryable transcription failures get one `whisper-large-v3` fallback after the configured model; account rate limits retain queue backoff. Model and provider are included in the task-completion event.

Ordinary private objects over 6 MiB use TUS with fixed 6 MiB chunks, bounded retries, cancellation and a ten-minute upload deadline. Both authorization and API-key headers are required. Worker-only source/audio/proxy artifacts larger than `STORAGE_UPLOAD_CHUNK_BYTES` use immutable chunk manifests; browser exports/previews remain ordinary media. This does not bypass the Supabase project's per-object limit for final exports. The opt-in `scripts/verify-production-storage.ts --write-storage` check verifies real upload/download byte equality and cleans up its exact disposable objects.

`services/video-worker/python-acquisition` is packaged into the existing Render image and bound to `127.0.0.1:8090`. It is not a public downloader and is not deployed on Vercel. Vercel Functions are an unsuitable media plane because request/response bodies are limited and invocation lifetime is bounded; a separate free Render service would introduce another cold start and consume the same monthly free-instance pool.

The Node worker submits an authenticated `POST /v1/downloads` and receives HTTP 202, then polls the status resource while maintaining the durable Supabase task heartbeat. Completed responses contain local artifact metadata, never media bytes. Node revalidates path containment, exact byte size, extension, malware/media properties, checksum and immutable Storage path before uploading directly to the private Supabase `source-media` bucket.

FastAPI accepts only canonical video IDs, an allowlisted container, the server-derived 720p/1080p/2160p plan cap, bounded duration and optional exact source section. It writes only beneath `WORKER_TEMP_ROOT`. `start.sh` generates separate per-container API and webhook secrets when absent, waits for Python health, and fails container startup if the process cannot become healthy. Signed callbacks are raw-body verified, schema and size bounded, mapped to fixed product copy, and inserted through a replay-safe service-role RPC before Supabase Realtime updates the UI.

The local-device relay and its pairing API were retired on 2026-07-30. Historical schema/status values remain readable for already-created rows, but no planner, route, UI, environment flag, or helper executable can create new relay requests.
