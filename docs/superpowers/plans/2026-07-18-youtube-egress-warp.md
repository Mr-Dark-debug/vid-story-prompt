# YouTube Egress and Authorised Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute this plan inline in the current session. Repository instructions prohibit unrequested subagent dispatch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make eligible YouTube URL jobs use observable protected egress and preserve the same job for authorised-source recovery when acquisition still fails.

**Architecture:** Keep the existing PostgreSQL queue, fixed yt-dlp client strategies, and isolated Docker worker. Add a pure proxy/attempt planner, a protected worker proxy-health probe, an original Cloudflare WARP private service, audited processing-event tiers, and a sanitized TanStack server boundary for UI health. Complete the in-progress `awaiting_authorised_source` flow so WARP failure is recoverable rather than terminal.

**Tech Stack:** Node 22, TypeScript, yt-dlp 2026.07.04, FFmpeg/FFprobe, Cloudflare WARP CLI, GOST, Docker/Compose, Render Blueprint, Supabase PostgreSQL/RLS, TanStack Start, React 19, Vitest, Playwright.

## Global Constraints

- Preserve `YTDLP_PROXY_URL` as the highest-priority operator override.
- Never expose proxy URLs, credentials, raw egress IPs, media URLs, filenames, transcripts, tokens, or yt-dlp stderr to browser code or product analytics.
- Keep OAuth limited to official YouTube Data API channel, upload, playlist, automation, and publishing capabilities.
- Do not bypass private, age-restricted, region-locked, removed, or rights-restricted media.
- Keep existing player-client rotation, IPv4 enforcement, PO-provider compatibility, leases, heartbeats, cancellation, retry classification, RLS, usage enforcement, and immutable paths.
- Use `processing_events`, the repository's source-of-truth event table; do not invent a parallel `job_events` table.
- Use a Debian slim WARP image because Cloudflare does not publish an official Alpine package; do not copy GPL-3.0 `warp-docker` source.
- Render private services require paid compute; do not claim the complete Render deployment is free.
- Do not edit `src/routeTree.gen.ts` manually.
- Never force-push, rebase, amend, or squash published Lovable commits.

---

### Task 1: Stabilize the existing authorised-source recovery

**Files:**
- Modify: `supabase/migrations/20260718230000_authorised_source_recovery.sql`
- Modify: `src/domain/clipping/types.ts`
- Modify: `src/domain/clipping/state-machine.ts`
- Modify: `src/domain/clipping/job-progress.ts`
- Modify: `src/services/clipping/server.ts`
- Modify: `services/video-worker/src/tasks/handlers.ts`
- Modify: `src/components/youtube-clipper/job-progress.tsx`
- Create/modify: `src/components/youtube-clipper/authorised-source-recovery.tsx`
- Test: `src/domain/clipping/job-progress.test.ts`
- Test: `src/components/youtube-clipper/authorised-source-recovery.test.tsx`

**Interfaces:**
- Produces: `ClipJobStatus = "awaiting_authorised_source"`, `TaskStatus = "superseded"`.
- Produces: `attachSourceAndResumeClipJob(input)` and `attachDirectSourceAndResumeClipJob(input)`.
- Consumes: existing `source_attachments`, `media_assets`, `connector_imports`, `job_tasks`, usage ledger, and worker wake path.

- [ ] **Step 1: Run focused tests and typecheck to capture the incomplete baseline.**

Run:

```powershell
npm test -- src/domain/clipping/job-progress.test.ts src/components/youtube-clipper/authorised-source-recovery.test.tsx
npm run typecheck
npm --prefix services/video-worker run typecheck
```

Expected: record every current failure before changing the recovery implementation.

- [ ] **Step 2: Tighten the attachment RPC contract.**

The RPC must reject any status except `awaiting_authorised_source`, lock the job, validate same-user/same-workspace assets, enforce connector-import ownership, and make duplicate idempotency keys return the same attachment/task identifiers. Replace the permissive status check with:

```sql
if v_job.status <> 'awaiting_authorised_source' then
  raise exception 'source_recovery_not_available' using errcode = '22023';
end if;
```

Do not reserve usage again. Mark only the exhausted acquisition task `superseded`, then queue a unique `validate_source` task.

- [ ] **Step 3: Make worker validation authoritative and resumable.**

Use FFprobe duration and stream presence. Persist `source_match_json` with confidence and require confirmation for a material shorter-file mismatch; reject longer media that exceeds the reservation. Reuse already-succeeded child tasks only when their artifacts are valid for the newly attached source; source-dependent proxy/audio/transcript artifacts must not be reused across different media checksums.

- [ ] **Step 4: Make the recovery UI action-required, responsive, and same-job.**

Render amber/neutral semantic styling, upload, connected-storage, owner-controlled URL, and cancel actions inside the existing job detail. Never link to a new clipping wizard for this state.

- [ ] **Step 5: Re-run focused checks.**

Expected: tests pass and typecheck has no recovery-flow errors.

---

### Task 2: Add pure proxy selection and redaction

**Files:**
- Create: `services/video-worker/src/security/youtube-proxy.ts`
- Create: `services/video-worker/src/security/youtube-proxy.test.ts`
- Modify: `services/video-worker/src/config/env.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `resolveYouTubeProxy(input): ProxySelection`.
- Produces: `proxyEnvironment(selection): NodeJS.ProcessEnv`.
- Produces: `redactProxyUrl(url): string`.

- [ ] **Step 1: Write failing precedence tests.**

Cover:

```ts
expect(resolveYouTubeProxy({ ytdlpProxyUrl: "http://override:9000", warpProxyUrl: "http://warp:8080", production: true })).toMatchObject({ tier: "operator", url: "http://override:9000/" });
expect(resolveYouTubeProxy({ warpProxyUrl: "http://warp:8080", production: true })).toMatchObject({ tier: "warp" });
expect(resolveYouTubeProxy({ renderWarpHost: "warp.internal", renderWarpPort: 8080, production: true })).toMatchObject({ tier: "render_warp" });
expect(resolveYouTubeProxy({ production: false })).toEqual({ tier: "direct", url: undefined });
expect(() => resolveYouTubeProxy({ production: false, forceProxy: true })).toThrow(/proxy/i);
```

- [ ] **Step 2: Add validated worker-only environment fields.**

Add optional `WARP_PROXY_URL`, `WARP_PROXY_HOST`, `WARP_PROXY_PORT`, `YTDLP_PROXY_PROBE_TIMEOUT_MS`, and boolean `YTDLP_STARTUP_PROBE`. Reject URLs with unsupported protocols or embedded credentials in any value that could be logged.

- [ ] **Step 3: Implement precedence and subprocess environment.**

For a selected URL, set `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY` and lowercase equivalents. Redaction returns only the tier and host classification, never username/password/path/query.

- [ ] **Step 4: Run the focused worker test.**

Run:

```powershell
npm --prefix services/video-worker test -- src/security/youtube-proxy.test.ts
```

Expected: all four precedence cases and force-proxy failure pass.

---

### Task 3: Route yt-dlp through planned egress and support exact sections

**Files:**
- Modify: `services/video-worker/src/security/youtube-download.ts`
- Modify: `services/video-worker/src/security/youtube-download.test.ts`
- Modify: `services/video-worker/src/tasks/handlers.ts`

**Interfaces:**
- Consumes: `ProxySelection` from Task 2.
- Produces: `YouTubeSourceSection = { startSeconds: number; endSeconds: number }`.
- Produces: acquisition result metadata `{ proxyTier, strategy, sectionApplied }`.

- [ ] **Step 1: Add failing command-builder tests.**

Verify a proxy appears in `--proxy`, proxy credentials never appear in snapshots/log helpers, and a valid section adds:

```ts
expect(args).toEqual(expect.arrayContaining([
  "--downloader", "ffmpeg",
  "--download-sections", "*83-130",
]));
```

Reject negative, reversed, non-finite, or out-of-reservation ranges.

- [ ] **Step 2: Pass proxy flags and environment into execa.**

Use one proxy selection for the entire yt-dlp subprocess:

```ts
await execa(env.YTDLP_PATH, args, {
  env: proxyEnvironment(proxy),
  timeout: env.YTDLP_TIMEOUT_MS,
  cancelSignal: signal,
  reject: true,
});
```

- [ ] **Step 3: Apply exact sections only when task input contains a validated range.**

Do not invent a range from `durationRange`; ordinary AI-discovery jobs still need the full source. Return `sectionApplied: true` only when flags were actually used.

- [ ] **Step 4: Add a deterministic attempt planner.**

Direct client rotation remains first when allowed. `forceProxy` skips direct egress. If `YTDLP_PROXY_URL` is configured, it is the selected operator route rather than a second duplicate tier. Record the selected tier/strategy in the handler result and safe event metadata.

- [ ] **Step 5: Run download and handler tests.**

Expected: existing rotation tests remain green and new proxy/section tests pass.

---

### Task 4: Add protected proxy health and startup readiness

**Files:**
- Create: `services/video-worker/src/health/proxy-health.ts`
- Create: `services/video-worker/src/health/proxy-health.test.ts`
- Modify: `services/video-worker/src/http/server.ts`
- Modify: `services/video-worker/src/http/server.test.ts`
- Modify: `services/video-worker/src/index.ts`

**Interfaces:**
- Produces: `ProxyHealthSnapshot` with operator-only fields.
- Produces: authenticated `GET /health/proxy`.
- Consumes: worker bearer secret and `ProxySelection`.

- [ ] **Step 1: Write failing health tests.**

Unauthenticated requests return 401. Authenticated responses include tier, reachability, WARP state, redacted egress address, timestamps, and yt-dlp probe state but no proxy URL or credentials.

- [ ] **Step 2: Implement bounded trace and yt-dlp probes.**

Fetch `https://cloudflare.com/cdn-cgi/trace/` through the selected HTTP proxy with a timeout and parse `warp` and `ip`. Run:

```text
yt-dlp -F --no-warnings --no-playlist --ignore-config https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

through the same proxy/environment. Redact all failure detail before persistence/logging.

- [ ] **Step 3: Integrate startup readiness.**

Configured unreachable proxy sets worker readiness false and logs `proxy=failed`. Healthy protected egress logs `proxy=ok tier=<tier>` without the URL/IP. Direct development logs one warning. An external YouTube probe failure is degraded; it does not fabricate WARP success.

- [ ] **Step 4: Run HTTP and health tests.**

Expected: authentication, redaction, timeout, healthy, degraded, and blocked cases pass.

---

### Task 5: Persist proxy tiers and support force-proxy retry

**Files:**
- Create: `supabase/migrations/20260718231500_youtube_proxy_tiers.sql`
- Modify: `src/lib/supabase/database.types.ts` through the repository generator
- Modify: `src/services/clipping/server.ts`
- Modify: `services/video-worker/src/queue/repository.ts` or the current event-completion boundary discovered during implementation
- Test: relevant server/domain and Supabase integration tests

**Interfaces:**
- Produces: nullable `processing_events.proxy_tier` constrained to `direct`, `operator`, `warp`, `render_warp`, or `authorised_source`.
- Produces: `retryClipJobTask({ jobId, forceProxy })`.

- [ ] **Step 1: Add the migration.**

Use:

```sql
alter table public.processing_events add column if not exists proxy_tier text;
alter table public.processing_events add constraint processing_events_proxy_tier_check
  check (proxy_tier is null or proxy_tier in ('direct','operator','warp','render_warp','authorised_source'));
```

Replace `retry_clip_task(uuid)` with a backward-compatible function accepting `p_force_proxy boolean default false`. It may only set a boolean in trusted task input; it never accepts a proxy URL.

- [ ] **Step 2: Add server validation and tests.**

The browser may request `forceProxy: true`; the server and RPC verify ownership and retry eligibility. Exhausted tasks transition to authorised-source recovery rather than bypassing policy restrictions.

- [ ] **Step 3: Regenerate database types.**

Run:

```powershell
npm run supabase:types
```

If the configured Supabase CLI/runtime is unavailable, update nothing by hand until the generator path is repaired; report the precise blocker.

- [ ] **Step 4: Run database/server tests.**

Cover cross-workspace rejection, idempotent force retry, cancelled/expired rejection, and no proxy URL in task/event browser projections.

---

### Task 6: Build the original WARP private service

**Files:**
- Create: `services/video-worker/warp/Dockerfile`
- Create: `services/video-worker/warp/entrypoint.sh`
- Create: `services/video-worker/warp/healthcheck.sh`
- Create: `services/video-worker/warp/README.md`
- Create: `services/video-worker/warp/docker-compose.test.yml`
- Create: `services/video-worker/warp/smoke-test.sh`
- Modify: `render.yaml`

**Interfaces:**
- Produces: HTTP CONNECT proxy on internal port 8080.
- Produces: container health requiring `warp=on|plus`.
- Produces: Render service host reference consumed as `WARP_PROXY_HOST`.

- [ ] **Step 1: Create a checksum-pinned Debian slim image.**

Install Cloudflare's signed package repository and official `cloudflare-warp` package. Download a fixed GOST release for `TARGETARCH`, verify SHA-256, and install no compiler in the final image.

- [ ] **Step 2: Implement idempotent startup.**

Start dbus and `warp-svc`, wait boundedly, register only when no persisted registration exists, set proxy mode/port 40000 before connect, connect, verify `warp=on|plus`, then exec GOST listening on `0.0.0.0:8080` and forwarding to `127.0.0.1:40000`.

- [ ] **Step 3: Add local Compose smoke test.**

The smoke service curls Cloudflare trace through `http://warp-proxy:8080`, verifies WARP is enabled, and prints `proxy=ok egress_ip=<redacted-prefix>` before exit 0.

- [ ] **Step 4: Add Render Blueprint wiring.**

Add a Frankfurt `pserv` named `vidrial-warp-proxy` on `starter`, persistent registration disk, port 8080, and health check. Inject its `host` property and port into `vidrial-video-worker`. Keep `YTDLP_PROXY_URL` as `sync: false` override.

- [ ] **Step 5: Run smoke test when Docker exists.**

Run:

```powershell
docker compose -f services/video-worker/warp/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from smoke
```

Expected: exit 0 and `proxy=ok`. Current host discovery shows Docker is unavailable; do not claim this check until it actually runs.

---

### Task 7: Add sanitized app health service and WorkerEgressBadge

**Files:**
- Modify: `src/services/worker/server.ts`
- Create: `src/components/dashboard/WorkerEgressBadge.tsx`
- Create: `src/components/dashboard/WorkerEgressBadge.test.tsx`
- Modify: `src/components/youtube-clipper/job-wizard.tsx`
- Modify: `src/components/youtube-clipper/job-progress.tsx`

**Interfaces:**
- Produces: `getWorkerEgressHealth()` server function returning only status/tier/message/time.
- Produces: `WorkerEgressBadge` with healthy/degraded/blocked/unknown states.

- [ ] **Step 1: Write failing server-boundary and component tests.**

Assert the client result has no `proxy_url`, `egress_ip`, host, or credentials. Test text, icons, semantic status, tooltip/detail, loading, and 360px-safe wrapping.

- [ ] **Step 2: Implement the authenticated server call.**

Call worker `/health/proxy` with `WORKER_WAKE_SECRET`, map operator fields to:

```ts
type WorkerEgressHealth = {
  status: "healthy" | "degraded" | "blocked" | "unknown";
  tier: "protected" | "operator" | "direct" | "none";
  checkedAt: string | null;
  message: string;
};
```

- [ ] **Step 3: Surface the badge and retry action.**

Show the badge in the source step and job detail. `Retry through protected egress` passes only `{ jobId, forceProxy: true }`. The authorised-source panel remains the final recovery route.

- [ ] **Step 4: Run focused UI tests.**

Expected: badge states, copy, no secret fields, and force-proxy action pass.

---

### Task 8: Make YouTube/OAuth copy truthful

**Files:**
- Modify: `src/routes/_authenticated.app.settings.integrations.tsx`
- Modify: `src/components/youtube-clipper/job-wizard.tsx`
- Modify: `src/components/youtube-clipper/job-progress.tsx`
- Test: existing integrations/wizard/job-progress tests or focused new tests

**Interfaces:**
- Consumes: central connector registry and `WorkerEgressBadge`.

- [ ] **Step 1: Add copy assertions.**

Require headings `Connect YouTube account` and `Clip a YouTube URL`, plus copy that OAuth is optional and does not enable downloads.

- [ ] **Step 2: Update connector and failure copy.**

For provider challenge/403, use truthful network-block copy and immediately offer same-job original upload. For private, age, or region restrictions, explain that protected egress does not bypass them.

- [ ] **Step 3: Verify responsive behavior.**

At 360px, actions wrap vertically or within container width; no horizontal overflow or fixed-width metadata cards.

---

### Task 9: Documentation and worklog

**Files:**
- Create or modify: `docs/VIDEO_WORKER.md`
- Create or modify: `docs/YOUTUBE_CLIPPER.md`
- Modify: `docs/CONNECTOR_MATRIX.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `.env.example`
- Append: `docs/superpowers/plans/2026-07-18-youtube-egress-warp.md`

- [ ] **Step 1: Document proxy precedence and fail-closed behavior.**

Include operator override, explicit WARP URL, Render host wiring, development direct mode, health endpoint authentication, startup probe, and how to diagnose each status.

- [ ] **Step 2: Document OAuth and recovery boundaries.**

State that OAuth is for official Data API capabilities, not yt-dlp login. Explain same-job authorised-source recovery and no double charging.

- [ ] **Step 3: Record residual risks and verified evidence.**

Document WARP blocking risk, Cloudflare availability/limits, paid Render private compute, no age/region/private bypass, GPL correction, missing local Docker, and `YTDLP_PROXY_URL`/authorised-source escape hatches.

---

### Task 10: Full verification, deployment, and production evidence

**Files:**
- Modify only files required to fix failures discovered by verification.

- [ ] **Step 1: Format and run all local checks.**

Run:

```powershell
npx prettier --write <changed-files>
npm run typecheck
npm run lint
npm test
npm run build
npm --prefix services/video-worker run typecheck
npm --prefix services/video-worker test
npm --prefix services/video-worker run build
```

Expected: every available check exits 0.

- [ ] **Step 2: Run Supabase integration and migration verification.**

Use the configured local/remote tooling only after confirming the target project. Apply migrations in order, regenerate types, and verify RLS/RPC behavior. Never print service-role secrets.

- [ ] **Step 3: Run Playwright/browser verification.**

Verify the connector dialog, badge states, same-job recovery, force-proxy retry, realtime refresh, and no 360px horizontal overflow. Do not solve CAPTCHAs or fabricate YouTube success.

- [ ] **Step 4: Commit normal history and push only after checks pass.**

Stage only this task's files plus the pre-existing authorised-recovery work that was audited and completed. Preserve unrelated `AGENTS.md` changes. Use normal commits; no amend/rebase/force push.

- [ ] **Step 5: Verify Vercel and Render deployments.**

Confirm Vercel production/preview build, Render WARP private service health, worker readiness, and protected egress probe. If Render cannot run the WARP daemon or requires unavailable billing/capabilities, report the exact external blocker.

- [ ] **Step 6: Run a controlled production job.**

Reuse the previously failing controlled video `XzXM7V7t4ts` only if the user owns or is authorised to process it; otherwise use an authorised test video. Confirm the event stream records a safe proxy tier and the job either completes or transitions to same-job authorised-source recovery. For an exact-section task, confirm `sectionApplied=true` and actual reduced transfer; do not infer it from configuration alone.

- [ ] **Step 7: Append final worklog results.**

Record exact command outcomes, migration/deploy revisions, job ID/URL when safe, production health, screenshots/artifacts, unresolved external blockers, and residual risks.

## Worklog

- 2026-07-18: Repository, dirty worktree, current worker, task/event model, Render Blueprint, yt-dlp upstream guidance, Cloudflare WARP packaging/terms, YouTube policy, and supplied evidence audited. Selected hybrid protected-egress plus same-job authorised-source recovery. Docker, Supabase CLI, and Vercel CLI are not currently installed globally on this Windows host; Bun, Node, npm, and the Git remote are available.

