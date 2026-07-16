# Video worker

`services/video-worker` is a Node.js 22 Docker service with FFmpeg, FFprobe and licensed Liberation fonts. It claims one leased task per container, heartbeats, honours cancellation and cleans its isolated temporary directory in `finally`.

Implemented handlers validate media, securely download direct sources, acquire rights-attested YouTube sources, build proxies, extract/chunk audio, transcribe with Groq/OpenAI fallback, merge overlap words, plan candidates through OpenRouter, deduplicate/select diverse moments, render previews/final exports, create SRT/VTT/ASS and delete expired assets.

The image pins yt-dlp `2026.07.04` and verifies the upstream SHA-256 during its Docker build. `YTDLP_PATH` defaults to `yt-dlp` and `YTDLP_TIMEOUT_MS` defaults to ten minutes. The command builder explicitly enables the image's Node 22 runtime for yt-dlp's bundled YouTube challenge solver, disables cookies, config files, cache, playlists, live video, partial files and unbounded retries, and applies the global source-size bound plus the job's reserved-duration bound. The handler polls job cancellation while yt-dlp runs and cannot move a cancelled job back into validation.

Use at least 4 vCPU, 8 GB RAM and 20 GB temporary disk per render container. Horizontal scaling is safe because database leases and idempotency keys are authoritative.

The worker also polls `connector_tasks`. Provider imports use official bearer-authorised endpoints, never browser-supplied headers. Transfers are streamed with the global maximum-size limit, heartbeat byte progress, MIME checks, checksum, FFprobe validation, immutable paths and `finally` cleanup. Configure `CONNECTOR_TOKEN_ENCRYPTION_KEY` identically in the web and worker environments.
