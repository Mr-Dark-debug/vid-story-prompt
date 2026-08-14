# YouTube Clipper Hardening Implementation Plan

> **For implementers:** Execute the tasks in order, keep `docs/prompts/logs/2026-08-14-clipper-hardening.md` current, and commit only validated, buildable units. Do not rewrite published Lovable history.

**Goal:** Make protected YouTube acquisition materially more reliable, ship explainable scored clip results and a manifest-faithful editor/render path, add real credential-gated publishers, and verify the deployed production system honestly.

**Architecture:** Extend the existing TanStack Start, Supabase, leased Node worker, loopback Python acquisition, connector registry, OAuth/token store, and automation queue. No parallel downloader, editor store, or publishing subsystem is introduced.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript, Zod, Supabase PostgreSQL/Storage/RLS, Node 22, Python/FastAPI/yt-dlp, FFmpeg/libass, Vitest, pytest, Playwright, Docker, Render, Vercel.

## Global constraints

- Preserve the rights attestation and all source prohibitions.
- Never use cookies or direct production egress.
- Keep secrets and implementation-sensitive acquisition details out of browser-visible state.
- Use `src/domain/connectors/registry.ts` as connector source of truth.
- Do not edit `src/routeTree.gen.ts` by hand.
- Preserve the pre-existing blog/SEO work and classify its failures separately.

### Task 1: Harden acquisition pacing and diagnostic contracts

**Files:**
- Modify: `services/video-worker/python-acquisition/app/downloader.py`
- Modify: `services/video-worker/python-acquisition/app/models.py`
- Modify: `services/video-worker/python-acquisition/tests/test_downloader.py`
- Modify: `services/video-worker/src/config/env.ts`
- Modify: `services/video-worker/src/health/proxy-health.ts`
- Modify: `services/video-worker/src/index.ts`
- Modify: `services/video-worker/src/security/acquisition-plan.ts`
- Modify tests beside those files

- [ ] Add failing tests for bounded 5-10 second pacing configuration and no pacing bypass.
- [ ] Apply pacing to yt-dlp requests/attempt transitions without introducing unbounded sleeps.
- [ ] Add sanitized tier readiness/reason codes for operator proxy, protected pool, and Cobalt.
- [ ] Remove executable `local_relay` planning vocabulary while retaining historical DB compatibility.
- [ ] Run Python tests plus focused worker tests and build.

### Task 2: Make Cobalt and operator-proxy setup deployable

**Files:**
- Modify: `render.yaml`
- Modify: `services/cobalt/render.example.yaml`
- Modify: `services/cobalt/README.md`
- Modify: `.env.example`
- Modify: `docs/VIDEO_WORKER.md`
- Modify: `docs/DEPLOYMENT.md`
- Add/modify configuration tests where present

- [ ] Add an authenticated free-plan Cobalt service to the active blueprint and private worker wiring.
- [ ] Document API-key generation, URL shape, health test, cold-start tradeoff, and rotation.
- [ ] Document operator proxy URL formats, safe verification, precedence, failure recovery, and the paid-sidecar tradeoff.
- [ ] Verify the committed yt-dlp version/hash is current and record the evidence.
- [ ] Run configuration validation and worker tests.

### Task 3: Replace internal acquisition copy with fixed product language

**Files:**
- Modify: `src/services/worker/server.ts`
- Modify: `src/components/dashboard/WorkerEgressBadge.tsx`
- Modify: `src/components/youtube-clipper/job-progress.tsx`
- Modify: fixed-event copy/domain helpers and tests

- [ ] Write tests that prohibit WARP, proxy, adapter, egress, Cobalt, IP, and raw error vocabulary in rendered customer copy.
- [ ] Present source connection state and actionable recovery in plain language.
- [ ] Keep operational tier/reason details only in the protected health endpoint and engineering logs.
- [ ] Run focused unit/component tests and mobile layout checks.

### Task 4: Build deterministic candidate generation and resilient scoring

**Files:**
- Modify: `services/video-worker/src/ai/schema.ts`
- Create: `services/video-worker/src/ai/candidates.ts`
- Create: `services/video-worker/src/ai/candidates.test.ts`
- Modify: `services/video-worker/src/ai/planner.ts`
- Modify: `services/video-worker/src/ai/planner.test.ts`
- Modify: `services/video-worker/src/ai/selection.ts`
- Modify: `services/video-worker/src/ai/selection.test.ts`
- Modify: candidate persistence/handler tests

- [ ] Test transcript segmentation, bounded windows, deterministic pre-scores, overlap removal, and topic diversity.
- [ ] Bound model input to shortlisted windows and add one schema-aware repair attempt.
- [ ] Add deterministic validated fallback candidates for provider failure.
- [ ] Extend the schema with platform copy while preserving score/title fields.
- [ ] Clamp and persist all candidate fields, including separate technical and overall scores.
- [ ] Run worker typecheck, tests, and build.

### Task 5: Ship the scored results gallery and title regeneration

**Files:**
- Modify: `src/services/clipping/server.ts`
- Create: `src/domain/clipping/score-presentation.ts`
- Create tests for score presentation/service ownership
- Create: `src/components/youtube-clipper/results-gallery.tsx`
- Create: `src/components/youtube-clipper/results-gallery.test.tsx`
- Modify: `src/components/youtube-clipper/job-progress.tsx`
- Add title-regeneration server action and worker/provider helper

- [ ] Load owned candidates, clips, versions, and signed previews in one bounded server response.
- [ ] Render consistent score bands, component scores, title, explanation disclosure, sorting, and minimum-score filtering.
- [ ] Add clip selection and bounded batch-export entry points using existing export services.
- [ ] Add editable per-clip title and one-clip validated regeneration.
- [ ] Verify keyboard access and 360/430/768/desktop containment.

### Task 6: Expand and validate the immutable edit manifest

**Files:**
- Modify: `services/video-worker/src/media/manifest.ts`
- Modify: matching app-side types/validators in `src/services/clipping/server.ts`
- Add a Supabase migration only if current JSON/version storage cannot hold required fields
- Modify related tests

- [ ] Define one versioned schema for title/social copy, crop/focal point, caption style/animation, overlays, and audio.
- [ ] Validate numeric/text/list bounds on both web server and worker.
- [ ] Enforce authenticated workspace ownership before every clip/version mutation.
- [ ] Preserve backward-compatible defaults for existing versions.
- [ ] Run focused type/tests.

### Task 7: Implement licensed caption presets and baked animations

**Files:**
- Modify: `services/video-worker/src/media/captions.ts`
- Create/modify: `services/video-worker/src/media/captions.test.ts`
- Modify: `services/video-worker/Dockerfile`
- Modify: `docs/VIDEO_WORKER.md`

- [ ] Test ASS escaping, cue wrapping, centisecond karaoke timing, line reveal events, pop transforms, font allowlist, and malformed timing.
- [ ] Implement Liberation Sans/Serif/Mono presets with consistent sizes/weights/stroke/shadow/background.
- [ ] Generate karaoke, line-reveal, and pop ASS from immutable cue/word timing.
- [ ] Keep SRT/VTT sidecars and document font licensing/source.
- [ ] Run worker tests/build and render short fixture samples locally when FFmpeg is available.

### Task 8: Complete FFmpeg/editor parity

**Files:**
- Modify: `services/video-worker/src/media/ffmpeg.ts`
- Modify: `services/video-worker/src/tasks/export.ts`
- Modify: `src/components/youtube-clipper/clip-editor.tsx`
- Add focused worker and component tests

- [ ] Build tested fit/fill/center/blur/focal-point graphs for 9:16, 1:1, and 16:9.
- [ ] Apply overlays, captions, audio gain/mute/fades/normalization, and worker-derived watermark.
- [ ] Add editor controls and a preview driven by the same manifest values.
- [ ] Implement title/social copy editing, safe-area overlay, undo/redo, immutable save, restore-as-new, and useful compare metadata.
- [ ] Verify export manifest checksums/version and downloadable output.

### Task 9: Add credential-gated official publishers

**Files:**
- Modify: `src/domain/connectors/registry.ts`
- Modify: `src/domain/connectors/publishing.ts`
- Modify: `src/services/connectors/oauth.server.ts`
- Add platform adapters under `src/services/connectors/`
- Add worker publishing handlers under `services/video-worker/src/tasks/`
- Modify queue dispatch, automation validation, settings/publish UI, docs, env examples, tests, and database migration if required

- [ ] Verify current official Meta documentation before implementing Instagram/Facebook requests.
- [ ] Add provider descriptors, exact callbacks, PKCE/state/scopes, encrypted token use, refresh/revocation, and credential detection.
- [ ] Implement TikTok upload/direct-post, Meta container/Page video publishing, and LinkedIn initialize/upload/finalize/post flows against official APIs.
- [ ] Keep each adapter disabled when credentials, account eligibility, scopes, or app review are absent.
- [ ] Default every new automation rule to approval required; test that source/import permissions never grant publishing.
- [ ] Document operator app-registration, review, scope, domain, and production-access checklists.

### Task 10: Repair preserved baseline blockers and run the full local gate

**Files:**
- Modify only pre-existing blog/SEO files required to make their own validators truthful
- Modify tests/e2e specs for newly shipped behavior

- [ ] Fix the recorded `readingTime` mismatch without discarding user content.
- [ ] Run `npm run content:validate` and `npm run content:audit`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run worker typecheck/build/tests and Python tests.
- [ ] Run available Supabase integration tests.
- [ ] Run `npm run test:e2e` with responsive and authenticated clipper coverage.
- [ ] Record every exit code and pre-existing warning in the journal.

### Task 11: Consolidate, deploy, and verify production

**Files:**
- Append: `docs/prompts/logs/2026-08-14-clipper-hardening.md`

- [ ] Preserve and commit scoped work in buildable conventional commits; merge current `origin/main` normally and resolve only real conflicts.
- [ ] Push `main` without rewriting history and confirm Vercel builds the pushed revision.
- [ ] Apply/synchronize Render blueprint/env safely, remove retired live flags, deploy the current worker image, and confirm revision/health/readiness/protected diagnostics.
- [ ] Stand up Cobalt on the free plan if Render accepts the blueprint with no payment; otherwise record the exact platform/cost blocker.
- [ ] Run one real authorised public-video job through the complete production timeline.
- [ ] Verify scored/titled candidates, two caption animation/font combinations, a final download, and YouTube publishing only when live credentials permit.
- [ ] Mark each brief section 4-10 done/partially done/blocked with job IDs, links, command evidence, and operator-only next actions.

