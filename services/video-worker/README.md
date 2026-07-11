# Vidrial video worker

Portable Node.js 22 worker for YouTube Clipper media processing. PostgreSQL/Supabase remains the source of truth; PGMQ wakes workers and `job_tasks` provides durable leases, retries, idempotency and restart recovery.

## Runtime

- Recommended baseline: 4 vCPU, 8 GB RAM, 20 GB temporary disk per active render.
- FFmpeg/FFprobe are installed in the image. Default concurrency is one task per container; scale containers horizontally within plan and provider limits.
- `/healthz` reports process liveness. `/readyz` verifies configuration, FFmpeg, FFprobe and Supabase.
- `SIGTERM` stops claiming work, aborts the active subprocess/provider request and allows 25 seconds for cleanup.

Copy the server-only variables from the repository `.env.example`. Never expose `SUPABASE_SERVICE_ROLE_KEY` in a browser or client-side deployment. Provider calls fail explicitly when credentials are absent; they do not return fake successful results.

Build with `docker build -t vidrial-video-worker services/video-worker`. Deploy the image to Railway, Render, Fly.io, Cloud Run or another Docker host with persistent outbound HTTPS and sufficient ephemeral disk.
