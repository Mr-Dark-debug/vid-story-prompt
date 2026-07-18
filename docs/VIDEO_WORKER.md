# Video worker

`services/video-worker` is a Node.js 22 Docker service with FFmpeg, FFprobe and licensed Liberation fonts. It claims one leased task per container, heartbeats, honours cancellation and cleans its isolated temporary directory in `finally`.

Implemented handlers validate media, securely download direct sources, acquire rights-attested YouTube sources, build proxies, extract/chunk audio, transcribe with Groq/OpenAI fallback, merge overlap words, plan candidates through OpenRouter, deduplicate/select diverse moments, render previews/final exports, create SRT/VTT/ASS and delete expired assets.

The image pins yt-dlp `2026.07.04` and verifies the upstream SHA-256 during its Docker build. `YTDLP_PATH` defaults to `yt-dlp` and `YTDLP_TIMEOUT_MS` defaults to ten minutes. The command builder explicitly enables the image's Node 22 runtime for yt-dlp's bundled YouTube challenge solver, disables cookies, config files, cache, playlists, live video, partial files and unbounded retries, and applies the global source-size bound plus the job's reserved-duration bound. The handler polls job cancellation while yt-dlp runs and cannot move a cancelled job back into validation.

## YouTube egress

YouTube acquisition uses one server-only proxy selection for both yt-dlp's `--proxy` option and the subprocess `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, and lowercase variables. Precedence is:

1. `YTDLP_PROXY_URL` — operator override, including an approved authenticated proxy.
2. `WARP_PROXY_URL` — explicit WARP HTTP proxy URL.
3. `WARP_PROXY_HOST` plus `WARP_PROXY_PORT` — Render private-service wiring.
4. direct egress only when no proxy is configured; this is degraded in production and normal for local development.

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
