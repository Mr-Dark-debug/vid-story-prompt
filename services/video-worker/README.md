# Vidrial video worker

Portable Node.js 22 worker for YouTube Clipper media processing. PostgreSQL/Supabase remains the source of truth; PGMQ wakes workers and `job_tasks` provides durable leases, retries, idempotency and restart recovery.

## Runtime

- Recommended baseline: 4 vCPU, 8 GB RAM, 20 GB temporary disk per active render.
- FFmpeg/FFprobe are installed in the image. Default concurrency is one task per container; scale containers horizontally within plan and provider limits.
- `/healthz` reports process liveness. `/readyz` verifies configuration, FFmpeg, FFprobe and Supabase.
- `SIGTERM` stops claiming work, aborts the active subprocess/provider request and allows 25 seconds for cleanup.

Copy the server-only variables from the repository `.env.example`. Never expose `SUPABASE_SERVICE_ROLE_KEY` in a browser or client-side deployment. Provider calls fail explicitly when credentials are absent; they do not return fake successful results.

Build with `docker build -t vidrial-video-worker services/video-worker`. Deploy the image to Railway, Render, Fly.io, Cloud Run or another Docker host with persistent outbound HTTPS and sufficient ephemeral disk. For capability-routed residential YouTube acquisition on Windows, see `home-worker/README.md`; it uses the same durable queue and never exposes a public media API.

## Motion Studio roles

For the dedicated Linux host setup, service unit and capability rollout, see
[`deploy/README.md`](deploy/README.md). The controller now proves Docker
isolation and a real watermarked H.264/AAC render at startup before claiming
work, then pins its process to the verified image ID.

Motion uses its own durable PostgreSQL task queue, not the source-acquisition process. Run the trusted controller with `npm run motion:start` after building. It holds Supabase/provider credentials and launches each HTML render or critique capture in a fresh credential-free container. The renderer image contains only the browser/FFmpeg runtime, three OFL font families and the seek contract. No source-acquisition or queue modules are included.

Build from the repository root:

```sh
docker build -f services/video-worker/Dockerfile.motion -t vidrial-motion-renderer:local .
```

The pinned Playwright Core version is 1.61.1; installation pins its Chromium revision. Fonts are Manrope, JetBrains Mono and EB Garamond (Latin, normal 400). They are embedded as data URLs, with OFL notices copied into the image. Liberation remains the installed fallback. Image size, cold start and host user-namespace support must be measured on the deployment host; they have not been measured on this Windows machine without Docker.

Linux CI verification on 2026-10-03 built a 1,482,593,030-byte image (1.48 GB)
and completed the startup isolation plus one-second H.264/AAC smoke in 2.86
seconds with the image already present. This excludes image download/build time
and is not a production-host cold-start measurement. All 21 motion tests passed,
including real Docker rendering, cancellation and timeout cleanup. See
[`docs/verification/motion-production-2026-10-03.md`](../../docs/verification/motion-production-2026-10-03.md)
for the exact CI run and remaining deployment boundaries.

Configure `WORKER_MOTION_ENABLED=true`, the explicit `WORKER_TASK_INCLUDE_TYPES=motion_generate,motion_render,motion_analyze_reference`, the sandbox image, and the absolute seccomp profile path. Generation/reference/critique have separate default-off switches. Set `MOTION_ALLOWED_MODELS` to verified provider model IDs and `MOTION_VISION_MODELS` to their vision-capable subset. The motion model seam currently resolves the platform OpenRouter key. The existing BYOK chat/clipping lane is preserved; wiring Motion Studio to those credentials remains a separate integration step.

Never mount the Docker socket into submitted-code containers. The trusted controller needs Docker access on a dedicated motion host. Its command uses non-root UID 10001, no network, a read-only root, dropped capabilities, no-new-privileges, a pinned seccomp profile, private IPC, bounded tmpfs and CPU/memory/PID/file limits. There is no native fallback for submitted HTML and no `--no-sandbox`. Host/kernel support for Chromium user namespaces is required; failure is fail-closed. Do not enable database `motion_runtime_config` capabilities until the corresponding controller/provider and sandbox checks pass.

Motion leases last 90 seconds with 5-second heartbeats. One controller processes one task at a time; PostgreSQL applies workspace concurrency, generation rate limits and render-second reservations. Cancellation, final failure and expired leases release reservations once. Successful immutable renders retain a verified manifest with source hash, dimensions, frame count, duration, audio and watermark state. A browser crash is retryable once; limits, lint rejection, blank frames and timeouts are final errors.

A completion response lost after a possible database commit is logged as uncertain. The controller preserves the uploaded object and leaves reconciliation to the durable lease; it does not delete an MP4 that may already back a ready render. Administrative garbage collection may remove unreferenced immutable uploads after a conservative retention window.

Verification:

```sh
npm run typecheck
npm test
npm run build
```

Set `MOTION_TEST_CHROMIUM_PATH` to run trusted authored Chromium/FFmpeg integration fixtures. They verify real MP4/AAC, browser API isolation, timeouts and cancellation, but do not prove Docker isolation. Set `MOTION_DOCKER_TEST_IMAGE` and `MOTION_TEST_SECCOMP_PROFILE` on a Docker host to exercise the disposable container fixture. Tests label these boundaries explicitly.

Original demo reproduction (trusted repository-authored scenes only): `npm run motion:fonts`, then `MOTION_TEST_CHROMIUM_PATH=... npm run motion:demos`. Twenty verified MP4s and posters are committed under `public/motion-demos`, with their HTML and manifests under `content/motion/scenes`. `node scripts/seed-motion-gallery.mjs` is a dry-run; the explicit `--publish` mode uploads to approved immutable paths only after the migration is deployed. It never seeds engagement counts.
## Tests

Run `bun run test` here (or `npm run worker:test` from the repository root). The suites use Vitest
APIs, so Bun's native `bun test` runner is intentionally refused by `bunfig.toml`: it cannot
execute `vi.mock`/`vi.mocked` and reports spurious failures.
