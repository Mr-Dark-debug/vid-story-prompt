# Home Worker, Real E2E, and Publishing Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Vidrial's production queue durably from this Windows machine's direct residential egress, prove one real clip job through download and playback, and leave each social publisher ready for operator-owned registration.

**Architecture:** Keep PostgreSQL/PGMQ as the only queue and ownership source. A locally built worker container uses `NODE_ENV=development`, direct egress, and no embedded WARP; Docker Compose gives it restart semantics, while a per-user Windows scheduled task starts Docker Desktop and reconciles the Compose project after sign-in. Secrets remain in an ignored local env file and never enter Git, terminal output, the engineering journal, browser-visible events, or product analytics.

**Tech Stack:** Windows 11, Docker Desktop with WSL 2, Docker Compose, PowerShell ScheduledTasks, Node.js 22/TypeScript, Python/FastAPI/yt-dlp, FFmpeg, Supabase/PostgreSQL/PGMQ, TanStack Start, Playwright.

## Global Constraints

- Never force-push, rebase, amend, or squash published Lovable history.
- Browser code receives only Supabase's publishable key; service-role and provider credentials remain server/worker only.
- Keep rights attestation, source-size/time bounds, no cookies, no playlists/live/private/age/region bypass, and no unproxied production fallback.
- Local direct acquisition is allowed only because `NODE_ENV` is not `production`; `ENABLE_EMBEDDED_WARP=false` is explicit.
- Queue consumers remain leased, heartbeat-driven, idempotent, cancellation-aware, and retry classified.
- Do not fabricate provider, worker, deployment, integration, render, playback, or publishing success.
- Account registration, phone/SMS verification, identity verification, business review, and developer-terms acceptance remain operator actions.
- Append evidence to `docs/prompts/logs/2026-08-14-clipper-hardening.md`; do not create a second engineering journal.
- The operator explicitly selected inline autonomous execution with no confirmation pauses; no subagent dispatch is used.

---

### Task 1: Install and prove Docker runtime prerequisites

**Files:**
- Modify: `docs/prompts/logs/2026-08-14-clipper-hardening.md`

**Interfaces:**
- Consumes: Windows virtualization/WSL status and `winget`.
- Produces: a working Docker Engine and Compose CLI, or exact evidence of the operator-only restart/BIOS boundary.

- [ ] **Step 1: Record the pre-install state.**

Run `Get-Command docker -ErrorAction SilentlyContinue`, `wsl --status`, and Windows optional-feature/virtualization checks. Expected: Docker absent; WSL/virtualization state recorded without secrets.

- [ ] **Step 2: Install Docker Desktop non-interactively.**

Run `winget install --exact --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements --silent`. Expected: package installed, or an exact restart/virtualization/UAC blocker.

- [ ] **Step 3: Start and verify the engine.**

Start Docker Desktop hidden, wait boundedly for `docker info`, then run `docker version` and `docker compose version`. Expected: client and server respond and Linux containers are active.

### Task 2: Add secret-safe durable home-worker operations

**Files:**
- Create: `services/video-worker/compose.home.yaml`
- Create: `scripts/home-worker.ps1`
- Modify: `services/video-worker/README.md`
- Modify: `.env.example`
- Test: `services/video-worker/src/security/acquisition-plan.test.ts`

**Interfaces:**
- Consumes: ignored `services/video-worker/.env.home.local` containing the four required production credentials.
- Produces: `Start`, `Stop`, `Status`, `InstallStartup`, and `RemoveStartup` actions; local health at `http://127.0.0.1:8787/healthz`; Compose service `vidrial-home-worker`.

- [ ] **Step 1: Lock the direct-tier invariant with a focused test.**

Add an assertion that `selectAcquisitionPlan({ production: false, ... })` includes direct acquisition while the same production input cannot silently select direct egress. Run `npm run worker:test -- src/security/acquisition-plan.test.ts`; expected: the new assertion passes without weakening production behavior.

- [ ] **Step 2: Add the Compose definition.**

Define one locally built worker service with `env_file: .env.home.local`, `NODE_ENV: development`, `ENABLE_EMBEDDED_WARP: "false"`, a stable `WORKER_ID`, port `127.0.0.1:8787:8080`, a bounded HTTP healthcheck, `restart: unless-stopped`, and a named temp volume. Do not place credential values in YAML.

- [ ] **Step 3: Add the PowerShell lifecycle script.**

Resolve repository paths from `$PSScriptRoot`; validate Docker, Compose, and the ignored env file; start Docker Desktop hidden when needed; wait at most five minutes; execute Compose with explicit project/file paths; register a current-user logon task with `Register-ScheduledTask`; and report only container/health state, never environment values.

- [ ] **Step 4: Validate the script and docs.**

Parse the script with `[System.Management.Automation.Language.Parser]::ParseFile`, verify the Compose model with `docker compose config --quiet`, and document exact start, stop, status, logs, startup-install, and startup-remove commands.

### Task 3: Populate legitimate shared configuration and launch the worker

**Files:**
- Create locally but never commit: `services/video-worker/.env.home.local`
- Modify: `docs/prompts/logs/2026-08-14-clipper-hardening.md`

**Interfaces:**
- Consumes: current Render values for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, and `OPENROUTER_API_KEY` through an authenticated operator session.
- Produces: a ready local worker with secrets never printed and a registered scheduled task.

- [ ] **Step 1: Acquire values without display.**

Use legitimate Render access to copy only the four named values into process memory/local ignored storage. Compare key presence and minimum validation lengths without emitting values.

- [ ] **Step 2: Build and start.**

Run `scripts/home-worker.ps1 -Action Start`. Expected: image build succeeds, `/healthz` returns HTTP 200, `/readyz` returns HTTP 200, and the sanitized health state identifies local revision/readiness without a credential leak.

- [ ] **Step 3: Install and prove startup durability.**

Run `scripts/home-worker.ps1 -Action InstallStartup`, inspect the task definition, stop/remove the container, trigger the task once, and verify the worker returns healthy. This proves reconciliation rather than merely recording a task registration.

### Task 4: Run Docker-backed Supabase and worker integration gates

**Files:**
- Modify only if a real defect is found: relevant test/runtime source
- Modify: `docs/prompts/logs/2026-08-14-clipper-hardening.md`

**Interfaces:**
- Consumes: Docker Engine and repository test scripts.
- Produces: concrete local Supabase status/migration/integration results and worker container tests.

- [ ] **Step 1: Start local Supabase and apply migrations.**

Run `npx supabase start` followed by `npx supabase db reset`. Expected: all forward migrations apply in a fresh database.

- [ ] **Step 2: Run integration suites.**

Run the repository's Supabase integration command discovered from `package.json`, plus worker tests/typecheck/build and Python acquisition tests. Fix only reproduced defects and rerun the smallest failing gate before the full gate.

### Task 5: Clear acquisition and run a real job end to end

**Files:**
- Modify only where a real failure is reproduced: worker/app/domain source and focused tests
- Modify: `docs/prompts/logs/2026-08-14-clipper-hardening.md`
- Create evidence under existing ignored test-output locations: screenshots and downloaded media

**Interfaces:**
- Consumes: a rights-attested eligible production job, the local direct worker, and existing queue/RPC controls.
- Produces: persisted source acquisition, transcript, scored/titled candidates, two caption-style renders, playable downloaded export, and YouTube publication only if an authorised credential/destination is already configured.

- [ ] **Step 1: Queue an eligible acquisition.**

Use the existing bounded retry if available; otherwise expire/cancel only through existing normal product/RPC behavior and create one fresh rights-attested public-video job. Record job/task IDs and timestamps.

- [ ] **Step 2: Observe every durable stage.**

Inspect sanitized queue/job/event state and worker logs until acquisition, validation, transcription, planning, candidate persistence, and rendering either complete or yield a concrete reproducible defect. Add a focused regression test before each code fix.

- [ ] **Step 3: Exercise two caption combinations.**

Create exports from two immutable edit versions using different licensed font/animation pairs, such as Liberation Sans + word highlight and Liberation Serif + pop. Confirm both render tasks complete.

- [ ] **Step 4: Download and validate media.**

Download a signed final export, run `ffprobe` for duration/video/audio streams, and decode it with `ffmpeg -f null -`. Capture real gallery/editor/export screenshots with no private source URL or secret visible.

- [ ] **Step 5: Publish conditionally.**

If an authorised YouTube destination is configured, publish through the existing review flow and record the provider-confirmed result. If not, mark only this provider step blocked and state the exact operator action.

### Task 6: Resolve expired awaiting-source jobs

**Files:**
- Modify only if required: retention cleanup SQL/service and focused tests
- Modify: `docs/prompts/logs/2026-08-14-clipper-hardening.md`

**Interfaces:**
- Consumes: current production job/task/retention state.
- Produces: each stale job either successfully retried through the normal bounded path or explicitly assigned to the existing expiry cleanup lifecycle.

- [ ] **Step 1: Inspect state without destructive guesses.**

Query job status, retention deadline, acquisition attempts, active leases, and eligible retry/cleanup behavior through server-side/admin tooling. Never log source URLs.

- [ ] **Step 2: Apply the documented lifecycle.**

Let one eligible retry clear if safe; route exhausted/expired jobs through normal expiry cleanup. If cleanup excludes action-required jobs unintentionally, add a forward migration plus integration test rather than ad-hoc deletion.

### Task 7: Close design-system and publishing handoff documentation

**Files:**
- Create: `docs/DESIGN_SYSTEM.md`
- Modify: `docs/CONNECTOR_MATRIX.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/prompts/logs/2026-08-14-clipper-hardening.md`

**Interfaces:**
- Consumes: `docs/BRANDIDENTITY.md`, `src/styles.css`, registry callback ids, route implementation, current official platform consoles/docs, and existing env schema.
- Produces: one non-duplicative design-token index and four under-15-minute operator registration checklists.

- [ ] **Step 1: Create the design-system index.**

Document that brand geometry/licensing lives in `BRANDIDENTITY.md`, runtime semantic tokens live in `src/styles.css`, logo usage lives in `src/components/primitives/logo.tsx`, and component behavior/accessibility follows existing primitives. Do not duplicate mutable token values unnecessarily.

- [ ] **Step 2: Verify callbacks from code.**

Confirm `/auth/connectors/$connectorId/callback` and ids `facebook`, `instagram`, `tiktok`, `linkedin`; record the four exact `https://vidrial.vercel.app/auth/connectors/<id>/callback` URLs.

- [ ] **Step 3: Verify current official setup facts.**

Use official Meta, TikTok, and LinkedIn sources for console start URLs and scope/product requirements. Reconcile them with `CONNECTOR_MATRIX.md` and the worker adapter; do not enable unverified permissions.

- [ ] **Step 4: Write concise checklists.**

For each platform include the official console URL, callback, exact repository scopes, live privacy/terms/acceptable-use URLs, and exact environment variable names. Clearly reserve identity, phone, terms, and review steps for the operator.

### Task 8: Full verification, commits, deployment decision, and continuous journal

**Files:**
- Modify: `docs/prompts/logs/2026-08-14-clipper-hardening.md`

**Interfaces:**
- Consumes: all implemented changes and evidence.
- Produces: buildable commits, a clear Render-worker keep/suspend decision, and a final §1-§4 report marked done/partially done/blocked.

- [ ] **Step 1: Run proportional full gates.**

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, worker typecheck/tests/build, Python tests, local Supabase integration, and relevant Playwright/browser verification. Record exact counts and honest skips.

- [ ] **Step 2: Decide Render worker state.**

Leave it running as leased/idempotent backup or suspend it to save free-tier hours. Record the live state and reason; do not claim a state not verified in Render.

- [ ] **Step 3: Commit buildable increments normally.**

Review `git diff`, stage only this round's intended files, commit without history rewriting, push `main`, and verify deployments only if the change set requires them.

- [ ] **Step 4: Append final evidence.**

Add one Round 2 dated journal entry with job ID, screenshots, acquisition/render/playback evidence, startup task/health evidence, integration results, stale-job decision, platform checklists, and one done/partially done/blocked entry for each requested §1-§4 section.
