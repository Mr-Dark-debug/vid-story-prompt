# Production Acquisition Remediation Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a permitted YouTube clip from source acquisition through rendered preview and authorized download, while preserving Vidrial's cloud worker for downstream processing and all existing security boundaries.

**Architecture:** Upgrade the pinned yt-dlp runtime to the current stable release that replaces the broken `android_vr` default path with maintained clients and bundles the required EJS solver. Add capability-aware database claiming so Render excludes YouTube acquisition while a dedicated, user-scoped Windows acquisition worker claims only `download_youtube_source`; subsequent tasks continue on the cloud worker. The Windows supervisor uses the existing Supabase queue, local Python API, FFmpeg-static binaries, an ignored user-only secret file, and direct residential egress without exposing an inbound public service.

**Tech Stack:** TanStack Start, TypeScript, Node.js 24, Python 3.13, FastAPI, yt-dlp 2026.08.19, yt-dlp-ejs 0.8.0, FFmpeg, Supabase/PostgreSQL, PowerShell, GitHub, Vercel, Render.

## Global Constraints

- Never force-push, rebase, amend, squash, or discard published Lovable history.
- Preserve existing dirty root-worktree files by implementing in the isolated `codex/youtube-acquisition-20260823` worktree.
- Keep service-role, worker, webhook, provider, and proxy secrets server-side and out of logs, commits, screenshots, and browser responses.
- Keep rights attestation, workspace RLS, immutable object paths, server-derived watermarking, SSRF controls, task leasing, heartbeats, cancellation, idempotency, and retry classification.
- Keep `YTDLP_PROXY_URL`, protected WARP, Cobalt, authorised-source recovery, IPv4 enforcement, and bounded retries as fallbacks.
- Never use cookies, OAuth, or challenge bypasses to acquire public media.
- Do not claim production success until one Creative Commons source reaches a persisted rendered artifact and an authorized signed download.

---

### Task 1: Lock the current yt-dlp compatibility repair

**Files:**
- Modify: `services/video-worker/Dockerfile`
- Modify: `services/video-worker/python-acquisition/requirements.txt`
- Modify: `services/video-worker/src/security/youtube-download.ts`
- Modify: `services/video-worker/src/security/acquisition-plan.ts`
- Test: `services/video-worker/src/security/youtube-download.test.ts`
- Test: `services/video-worker/src/security/acquisition-plan.test.ts`
- Test: `services/video-worker/python-acquisition/tests/test_downloader.py`

**Interfaces:**
- Consumes: yt-dlp stable `2026.08.19`, Node 22+, and the existing Python acquisition request schema.
- Produces: current EJS-capable extraction and a client rotation that never selects deprecated `android_vr`.

- [ ] Add regression expectations that `android-vr` is no longer selected and that the standard path retains section downloads, Node EJS runtime, IPv4 binding, and conservative pacing.
- [ ] Update the Docker binary pin to `2026.08.19` with SHA-256 `1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6`.
- [ ] Install `yt-dlp[default,curl-cffi]==2026.8.19` for the Python acquisition API so `yt-dlp-ejs` and supported networking dependencies move with yt-dlp.
- [ ] Replace the explicit `android-vr` strategy with maintained fallback ordering and update tests.
- [ ] Run focused TypeScript and Python tests, then perform a real 10-second Creative Commons section probe.

### Task 2: Route tasks by worker capability

**Files:**
- Create: `supabase/migrations/20260823220000_worker_task_capability_routing.sql`
- Create: `services/video-worker/src/queue/task-capabilities.ts`
- Create: `services/video-worker/src/queue/task-capabilities.test.ts`
- Modify: `services/video-worker/src/config/env.ts`
- Modify: `services/video-worker/src/queue/repository.ts`
- Modify: `render.yaml`
- Modify: `.env.example`

**Interfaces:**
- Consumes: optional comma-separated `WORKER_TASK_INCLUDE_TYPES` and `WORKER_TASK_EXCLUDE_TYPES`.
- Produces: `claim_clip_task_for_capabilities(worker, lease, include, exclude)` restricted to `service_role` and compatible with existing queue state.

- [ ] Add failing tests for normalization, duplicate removal, invalid names, overlap rejection, include-only acquisition, and exclude-only cloud behavior.
- [ ] Add a forward-only security-definer RPC with an empty search path and explicit relation qualification.
- [ ] Update the worker repository to claim through the capability-aware RPC.
- [ ] Configure Render to exclude only `download_youtube_source`; leave every downstream task available to the cloud worker.
- [ ] Document environment precedence and fail configuration parsing when include/exclude overlap.
- [ ] Run worker tests and linked migration lint before applying the migration.

### Task 3: Install a user-scoped Windows acquisition worker

**Files:**
- Create: `services/video-worker/home-worker/README.md`
- Create: `services/video-worker/home-worker/install.ps1`
- Create: `services/video-worker/home-worker/supervise.ps1`
- Create: `services/video-worker/home-worker/status.ps1`
- Create: `services/video-worker/home-worker/uninstall.ps1`
- Create: `services/video-worker/home-worker/home-worker.test.ps1`
- Modify: `.gitignore`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/VIDEO_WORKER.md`

**Interfaces:**
- Consumes: root `.env` Supabase/provider values, local Node/Python, and the worker package.
- Produces: a localhost-only, auto-restarting acquisition worker with `WORKER_TASK_INCLUDE_TYPES=download_youtube_source`, isolated runtime data, redacted logs, and user-logon startup.

- [ ] Add PowerShell tests for environment parsing, path containment, secret redaction, and generated command arguments.
- [ ] Install Python dependencies in a local virtual environment and use repository FFmpeg-static/FFprobe-static binaries.
- [ ] Generate acquisition callback secrets with a cryptographic RNG into `%LOCALAPPDATA%\Vidrial\home-worker\secrets.env`; never print them.
- [ ] Run Python acquisition and Node queue consumer as supervised child processes with bounded restart backoff and graceful termination.
- [ ] Register a current-user logon task or Startup entry without administrator rights and provide status/uninstall commands.
- [ ] Bind health ports to localhost and prove no inbound public service is required.

### Task 4: Verify, deploy, and close the production flow

**Files:**
- Modify: `docs/prompts/logs/2026-08-14-clipper-hardening.md`
- Create: `docs/superpowers/plans/2026-08-23-production-verification.md`

**Interfaces:**
- Consumes: green repository gates, applied capability migration, running home acquisition worker, Render worker, and Vercel application.
- Produces: merged revisions and a fresh evidence-backed release disposition.

- [ ] Run typecheck, lint, app tests, build, worker typecheck/build/tests, Python tests, content validation/link audit, migration lint, and relevant Playwright suites.
- [ ] Apply the forward migration and verify the remote migration ledger.
- [ ] Push the feature branch, open a PR with official upstream sources and probe evidence, wait for checks, and merge without rewriting history.
- [ ] Confirm the exact Vercel and Render production revisions are healthy.
- [ ] Install/start the native acquisition worker and verify its capability-scoped health without exposing secrets.
- [ ] Submit the Creative Commons Big Buck Bunny source (`aqz-KE-bpKQ`) with a bounded section, confirm the home worker claims acquisition, and confirm Render claims downstream tasks.
- [ ] Verify persisted source asset, transcription, selected clips, rendered previews, playback, and authorized signed download.
- [ ] Repeat desktop/360px auth and clipper checks, console/network scan, accessibility checks, SEO endpoints, and representative Lighthouse measurements.
- [ ] Append exact commits, deployment IDs, task/job evidence, test counts, screenshots, verification boundaries, and residual risks to the worklogs.
