# Source Picker and YouTube Acquisition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicated source tiles with one logo-rich source picker and make rights-attested YouTube URLs enter the clipping worker without a browser upload.

**Architecture:** Keep the typed connector registry as the catalog and render provider marks in the shared icon component. Route pasted URLs with the pure URL detector, enqueue YouTube acquisition from PostgreSQL after job creation, and execute a fixed, bounded yt-dlp command in the Docker worker before the existing validation pipeline.

**Tech Stack:** React 19, TanStack Start, TypeScript, react-icons, Supabase PostgreSQL, Vitest, Docker, Node 22, yt-dlp, FFmpeg/FFprobe.

## Global Constraints

- Preserve the current three-step clipping wizard, application shell, semantic tokens, and Manrope fallback.
- Keep `src/domain/connectors/registry.ts` as the connector catalog source of truth.
- Require the existing versioned rights attestation and server-side plan enforcement before YouTube acquisition.
- Keep yt-dlp server-only with no browser dependency, cookie harvesting, proxy rotation, or arbitrary user arguments.
- Do not edit `src/routeTree.gen.ts` and do not rewrite published Git history.

---

### Task 1: Single source picker and provider marks

**Files:**

- Modify: `src/components/connectors/connector-icon.tsx`
- Modify: `src/components/connectors/source-picker.tsx`
- Modify: `src/components/connectors/source-picker.test.tsx`
- Modify: `src/components/connectors/coming-soon-connector-panel.tsx`
- Modify: `src/routes/_authenticated.app.settings.integrations.tsx`

**Interfaces:**

- Consumes: `ConnectorDefinition.id` and `ConnectorDefinition.icon` from the registry.
- Produces: `ConnectorIcon({ connectorId, icon, className })` with a provider mark or deliberate category fallback.

- [x] **Step 1: Change the picker test to assert the quick-action grid is absent and selection still works through search.**
- [x] **Step 2: Run `npx vitest run src/components/connectors/source-picker.test.tsx` and verify the old grid assertion fails.**
- [x] **Step 3: Remove `quickIds`, render the desktop popover/mobile drawer trigger as the only selector, and pass connector ids to every icon call.**
- [x] **Step 4: Map installed react-icons marks for known providers, bundle local provider marks for the remaining branded connectors, and retain semantic icons for generic protocols.**
- [x] **Step 5: Re-run the focused picker and provider-mark tests and expect them to pass.**

### Task 2: URL routing and upload-free YouTube source step

**Files:**

- Modify: `src/domain/connectors/registry.ts`
- Modify: `src/components/youtube-clipper/job-wizard.tsx`
- Modify: `src/components/youtube-clipper/job-wizard.test.tsx`
- Modify: `src/components/youtube-clipper/job-progress.tsx`

**Interfaces:**

- Consumes: `detectUrlSource(value: string): DetectedSource` and official YouTube metadata.
- Produces: YouTube submission with `sourceType: "youtube_metadata"`, `sourceAssetId: null`, and a validated video id after rights confirmation.

- [x] **Step 1: Add a wizard test proving YouTube can continue without invoking local upload and a direct-link paste routes a YouTube URL to the YouTube panel.**
- [x] **Step 2: Run the focused wizard test and verify it fails on the existing upload guard.**
- [x] **Step 3: Remove only the YouTube upload guard, retain the local-upload guard, and replace the YouTube upload panel with a server-acquisition explanation.**
- [x] **Step 4: Use `detectUrlSource` in the link panel to switch known links to their registry connector without downloading during detection.**
- [x] **Step 5: Add `download_original` to YouTube's registry capabilities, clear `requiresOriginalSource`, and show `awaiting_source` as acquisition progress.**
- [x] **Step 6: Re-run focused wizard, catalog, and source-picker tests and expect them to pass.**

### Task 3: Durable YouTube acquisition queue entry

**Files:**

- Create: `supabase/migrations/20260715233000_youtube_acquisition_queue.sql`
- Modify: `src/integration/supabase.integration.test.ts`

**Interfaces:**

- Consumes: `clip_jobs.youtube_video_id`, `clip_jobs.source_type`, and the existing `clip_tasks` outbox/lease queue.
- Produces: one `download_youtube_source` task with input `{ "videoId": "..." }` and idempotency key `<job-id>:download-youtube`.

- [x] **Step 1: Add an opt-in Supabase integration assertion for a YouTube job with no source asset.**
- [x] **Step 2: Replace the initial-source trigger function so direct URLs keep their current task and YouTube metadata jobs enqueue `download_youtube_source`.**
- [x] **Step 3: Update the database connector definition for YouTube media-import capability and lock the trigger function to service-owned execution.**
- [x] **Step 4: Run the integration suite when `RUN_SUPABASE_INTEGRATION=1`; otherwise record it as credential/runtime gated.**

### Task 4: Bounded and testable yt-dlp worker execution

**Files:**

- Modify: `services/video-worker/Dockerfile`
- Modify: `services/video-worker/src/config/env.ts`
- Modify: `services/video-worker/src/security/youtube-download.ts`
- Create: `services/video-worker/src/security/youtube-download.test.ts`
- Modify: `services/video-worker/src/tasks/handlers.ts`

**Interfaces:**

- Produces: `buildYouTubeDownloadArgs(videoId, directory, maximumDurationSeconds)` and `downloadYouTubeMedia(videoId, directory, maximumDurationSeconds, signal?)`.

- [x] **Step 1: Add pure argument-builder tests for video-id validation, fixed format/output controls, no cookies/config, size bound, non-live filter, and duration bound.**
- [x] **Step 2: Run the worker test and verify the missing builder fails.**
- [x] **Step 3: Implement the builder, enable the Docker image's Node 22 challenge runtime, pass the worker cancellation signal to execa, and avoid persisting raw yt-dlp stderr, URLs, or filenames in task errors.**
- [x] **Step 4: Pass the reserved job duration into the downloader and recover immediately when the job already has a source asset.**
- [x] **Step 5: Pin Docker to yt-dlp `2026.07.04` and verify the official SHA-256 `495be29ff4d9d4e9be7eabdfef225221e5d5282e77f2f505abc6dca80349f3fd`.**
- [x] **Step 6: Run worker typecheck and tests and expect them to pass.**

### Task 5: Full verification

**Files:**

- Modify only files above if verification exposes regressions.

- [x] **Step 1: Format only touched files with Prettier.**
- [x] **Step 2: Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm --prefix services/video-worker run typecheck`, and `npm run worker:test`.**
- [x] **Step 3: Run the focused Playwright source-picker flow against the local app when authentication/runtime configuration is available.**
- [x] **Step 4: Review `git diff --check`, the final diff, and `git status --short`; report provider/OAuth/Supabase/runtime checks that could not be performed honestly.**

## Verification notes

- The authenticated source-picker page correctly redirects to login in a fresh browser session, so
  its interaction path was verified with component tests; Playwright verified the public clipper and
  protected-route return URL.
- The opt-in Supabase integration test was added but not executed against the configured non-local
  project because it creates users and rows.
- Docker was unavailable in this environment. A temporary copy of the pinned `yt-dlp` binary passed
  its SHA-256 check and completed a live download of licensed test media with the production-style
  argument set, Node 22 challenge solving, FFmpeg merge, and FFprobe validation. The temporary media
  and binary were removed after the test.
