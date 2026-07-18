# YouTube Worker and Progress Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct YouTube failure classification, make transient acquisition retryable, add a real authorized manual retry, and derive job progress/events from durable tasks.

**Architecture:** Preserve the existing PostgreSQL queue and worker boundaries. Add a pure worker classifier and fixed acquisition strategies, an atomic retry RPC plus server wrapper, sanitized task projections, and pure UI-domain mappers shared by the job list/detail.

**Tech Stack:** Node 22, TypeScript, yt-dlp, FFmpeg/FFprobe, Supabase PostgreSQL/RLS, TanStack Start, React 19, Vitest.

## Global Constraints

- `yt-dlp` runs only in the Docker worker after rights attestation and entitlement checks.
- No cookies, browser credentials, arbitrary proxies, raw URLs, stderr, tokens, or private filenames reach browser responses or product events.
- Download duration, bytes, redirects, DNS/IP, timeouts, FFprobe validation, leases, cancellation, and idempotency remain enforced.
- Retryable failures use the existing maximum-attempt contract; terminal source restrictions do not loop.
- Production provider success is not claimed until a live job completes.

---

### Task 1: Worker failure taxonomy and fixed strategies

**Files:**
- Modify: `services/video-worker/src/security/youtube-download.ts`
- Modify: `services/video-worker/src/security/youtube-download.test.ts`
- Modify: `services/video-worker/src/config/env.ts`
- Modify: `services/video-worker/Dockerfile`

**Interfaces:**
- Produces: `classifyYouTubeDownloadFailure(message: string): TaskFailure`
- Produces: `buildYouTubeDownloadArgs(videoId, directory, maximumDurationSeconds, strategy?: "standard" | "mweb-pot")`

- [ ] **Step 1: Write fixture-based classifier tests**

```ts
expect(classifyYouTubeDownloadFailure("Sign in to confirm you’re not a bot")).toMatchObject({ code: "provider_auth_challenge", retryable: true });
expect(classifyYouTubeDownloadFailure("This video is age-restricted")).toMatchObject({ code: "video_age_restricted", retryable: false });
expect(classifyYouTubeDownloadFailure("Private video")).toMatchObject({ code: "video_private", retryable: false });
expect(classifyYouTubeDownloadFailure("HTTP Error 429")).toMatchObject({ code: "provider_rate_limited", retryable: true });
expect(classifyYouTubeDownloadFailure("timed out")).toMatchObject({ code: "provider_temporary_failure", retryable: true });
```

- [ ] **Step 2: Run worker tests and verify failure**

Run: `npm run worker:test -- src/security/youtube-download.test.ts`
Expected: FAIL because the classifier does not exist.

- [ ] **Step 3: Implement ordered classification and safe messages**

```ts
export function classifyYouTubeDownloadFailure(input: string) {
  const message = input.toLowerCase();
  if (message.includes("private video")) return new TaskFailure("video_private", "This YouTube video is private.", false);
  if (message.includes("age-restricted")) return new TaskFailure("video_age_restricted", "This YouTube video is age-restricted.", false);
  if (message.includes("sign in to confirm") || message.includes("not a bot")) return new TaskFailure("provider_auth_challenge", "YouTube temporarily challenged the worker. Vidrial will retry.", true);
  if (message.includes("429") || message.includes("too many requests")) return new TaskFailure("provider_rate_limited", "YouTube temporarily rate-limited the worker. Vidrial will retry.", true);
  if (message.includes("timed out") || message.includes("etimedout") || /http error 5\d\d/.test(message)) return new TaskFailure("provider_temporary_failure", "YouTube was temporarily unavailable. Vidrial will retry.", true);
  return new TaskFailure("provider_temporary_failure", "YouTube could not be reached. Vidrial will retry.", true);
}
```

Keep size/live/duration classification before the generic provider fallback.

- [ ] **Step 4: Add and test the fixed fallback strategy**

The fallback adds only pinned, worker-owned arguments:

```ts
if (strategy === "mweb-pot") {
  args.splice(args.length - 1, 0, "--extractor-args", "youtube:player_client=mweb");
}
```

Pin compatible yt-dlp, Node runtime, and PO-token provider versions in the Docker image after the image-level compatibility check. If the provider cannot be installed or exercised, keep the classifier/retry change and leave the fallback disabled rather than claiming support.

- [ ] **Step 5: Run worker type/tests/build**

Run: `npm run worker:test && npm --prefix services/video-worker run typecheck && npm --prefix services/video-worker run build`
Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add services/video-worker
git commit -m "fix: classify youtube acquisition failures"
```

### Task 2: Transactional manual retry

**Files:**
- Create: `supabase/migrations/20260718120000_retry_clip_task.sql`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `src/services/clipping/server.ts`
- Modify: `src/integration/supabase.integration.test.ts`

**Interfaces:**
- Produces SQL RPC: `public.retry_clip_task(p_job_id uuid) returns public.job_tasks`
- Produces server function: `retryClipJobTask({ data: { jobId: string } })`

- [ ] **Step 1: Add opt-in integration assertions**

Create a failed retryable task fixture, call `retry_clip_task`, and assert task `queued`, lease/error cleared, job error cleared, one retry event, and one outbox wake. Assert another workspace member is rejected and a terminal `video_private` task cannot retry.

- [ ] **Step 2: Run the Supabase integration test when configured**

Run: `RUN_SUPABASE_INTEGRATION=1 npm test -- src/integration/supabase.integration.test.ts`
Expected before migration: FAIL with missing function.

- [ ] **Step 3: Implement the security-definer RPC**

The function checks `auth.uid()`, workspace membership/role, locks the job and newest failed/dead task, rejects ineligible codes and exhausted attempts, updates the task to `queued`, clears leases/errors, restores the job to `queued`, inserts a processing event and outbox row, and returns the sanitized task row. Revoke from public/anon and grant to authenticated/service role.

- [ ] **Step 4: Add the server wrapper and wake call**

```ts
export const retryClipJobTask = createServerFn({ method: "POST" })
  .inputValidator(z.object({ jobId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = await requireSessionClient();
    const { data: task, error } = await supabase.rpc("retry_clip_task", { p_job_id: data.jobId }).single();
    if (error) throw new Error(toUserFacingRetryError(error));
    await wakeVideoWorkerSafely(task.clip_job_id);
    return task;
  });
```

- [ ] **Step 5: Regenerate/check types and run tests**

Run: `npm run supabase:types && RUN_SUPABASE_INTEGRATION=1 npm test -- src/integration/supabase.integration.test.ts`
Expected: PASS when the configured project has the migration.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260718120000_retry_clip_task.sql src/lib/supabase/database.types.ts src/services/clipping/server.ts src/integration/supabase.integration.test.ts
git commit -m "feat: add authorized clip task retry"
```

### Task 3: Task-derived progress domain

**Files:**
- Create: `src/domain/clipping/job-progress.ts`
- Create: `src/domain/clipping/job-progress.test.ts`
- Create: `src/components/youtube-clipper/job-status-badge.tsx`
- Create: `src/components/youtube-clipper/job-status-badge.test.tsx`
- Modify: `src/services/clipping/server.ts`

**Interfaces:**
- Produces: `deriveJobStages(job, tasks): DisplayStage[]`
- Produces: `getJobStatusPresentation(status): { label; tone; active }`
- Extends `getClipJob` result with `tasks`

- [ ] **Step 1: Write failing pure-domain tests**

```ts
expect(deriveJobStages(failedJob, [succeededDownload, failedTranscription])).toEqual(expect.arrayContaining([
  expect.objectContaining({ id: "validating", state: "completed" }),
  expect.objectContaining({ id: "transcribing", state: "failed" }),
]));
expect(getJobStatusPresentation("retry_wait")).toMatchObject({ label: "Retrying", tone: "warning" });
expect(getJobStatusPresentation("ready")).toMatchObject({ label: "Ready", tone: "success" });
```

- [ ] **Step 2: Run focused tests**

Run: `npm test -- src/domain/clipping/job-progress.test.ts src/components/youtube-clipper/job-status-badge.test.tsx`
Expected: FAIL because the files do not exist.

- [ ] **Step 3: Implement task projection and pure mappers**

Query `job_tasks` by `clip_job_id`, selecting only `id,task_type,status,attempt,max_attempts,next_attempt_at,started_at,completed_at,error_code,error_message,progress_current,progress_total,created_at`. Map task types to the ten display stages and never select `input_json`, `output_json`, leases, or idempotency keys.

- [ ] **Step 4: Implement reusable badge**

Use semantic tokens for success, warning, danger, info/cool, and neutral. Pair color with the human label and a reduced-motion-safe activity dot.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/domain/clipping/job-progress.test.ts src/components/youtube-clipper/job-status-badge.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/clipping/job-progress.ts src/domain/clipping/job-progress.test.ts src/components/youtube-clipper/job-status-badge.tsx src/components/youtube-clipper/job-status-badge.test.tsx src/services/clipping/server.ts
git commit -m "feat: derive clipping progress from tasks"
```

### Task 4: Job detail and event timeline

**Files:**
- Modify: `src/components/youtube-clipper/job-progress.tsx`
- Create: `src/components/youtube-clipper/job-progress.test.tsx`
- Modify: `src/routes/_authenticated.app.youtube-clipper.index.tsx`

**Interfaces:**
- Consumes: `deriveJobStages`, `JobStatusBadge`, `retryClipJobTask`
- Produces: chronological accessible processing timeline

- [ ] **Step 1: Write failing UI tests**

Assert completed stages remain completed for a failed job, the failed task stage is danger, retry-wait is warning, events render oldest-to-newest with attempt badges, and the retry button calls the server action only for eligible failures.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- src/components/youtube-clipper/job-progress.test.tsx`
Expected: FAIL against the status-index implementation.

- [ ] **Step 3: Replace guessed progress and wire retry**

Render `deriveJobStages(job, tasks)`, use `JobStatusBadge`, call `retryClipJobTask`, disable while pending, invalidate the router on success, and surface a reusable error dialog on failure.

- [ ] **Step 4: Render the semantic event timeline**

Reverse the descending service result before rendering. Show stage, severity icon, message, attempt, progress when available, and timestamp; keep safe error codes secondary.

- [ ] **Step 5: Reuse badges in the jobs list and run tests**

Run: `npm test -- src/components/youtube-clipper/job-progress.test.tsx src/components/youtube-clipper/job-status-badge.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/youtube-clipper src/routes/_authenticated.app.youtube-clipper.index.tsx
git commit -m "feat: show real clipping progress and events"
```

