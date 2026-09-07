# Clip Studio: Exact Cut, transcript discovery, shared review and reliability

> Implementation worklog. Unchecked items are not shipped or verified.

## Scope and evidence

Branch: `feat/clip-studio`, based on main `461ba8b` (fetched and reverified).
The updated Clip Studio brief supersedes the earlier Quick Clip brief. All
references below to Quick Clip describe the newly named Exact Cut mode.
Preserve the existing clipping-only product; do not restore the retired project/timeline editor.
Use the canonical `src/domain/clipping/entitlements.ts` and matching PostgreSQL plan rows.
No new subscription limits, paid default service, automatic publication, or rights bypass.

The seven required root documents and the clipping/timeline domain were read. The
worker runtime, queue, Python acquisition API, FFmpeg/captions/probe, transcription,
candidate planning/selection, source adapters, storage, export, cleanup, publishing,
health/webhook and home-worker deployment paths were traced end to end. Relevant
foundation, queue/dependency, usage/export/retention, connector/RLS/audit,
YouTube acquisition/recovery/proxy, callback and capability-routing migrations were
reviewed. Remaining test and integration fixtures will be inspected with each phase.

Findings:

- `planClips` consumes transcript words, not a YouTube identifier. Upload/direct
  sources already converge at `validate_source`; source parity needs a real upload
  verification, not a duplicate ranking service.
- `create_clip_job` reserves full source runtime. Quick Clip must separate source
  runtime validation from billable segment seconds inside the database transaction.
- Existing `maxClipsPerJob` is sufficient. UI selectors read canonical entitlements;
  PostgreSQL seeds enforce the corresponding values independently.
- Preview rendering currently requires a candidate although `clips.clip_candidate_id`
  is nullable. Per the updated brief, manual clips will have candidate rows with
  `origin=manual_timestamp`, nullable scores and immutable versions. Backfill existing
  candidates as `ai_discovery`; transcript selections use `transcript_selection`.
- Each preview currently downloads the stored source, but acquisition from the
  external provider happens once. Quick Clip will preserve that property.
- FFmpeg currently applies crop/resize, audio normalization and watermark filters.
  Stream-copy is only valid when no required transformation is bypassed; exact
  non-keyframe cuts may still need encoding even for compatible codecs.
- Workspace membership is broad. Choose review links, not a workspace role that
  silently grants access to unrelated jobs. Current export RPCs need additional
  idempotency/expiry/rights checks before accepting a review context.
- Error handling collapses distinct acquisition failures into an IP-block claim.
  Retry tiers are durable but currently advance immediately; add bounded backoff
  and one same-path retry for known transient errors, retaining attempt history.
- Root docs contain obsolete editor/typography descriptions. Follow BRANDIDENTITY
  and the current clipping routes; correct conflicting documentation as features ship.

Production evidence collected 2026-09-06: job
`5f282d40-4cc1-47af-bd2d-767a249fd439` reached ready with five previews and all
14 tasks succeeded. All five private preview objects returned HTTP 206 and MP4
headers. No export exists for that job: this is not full export/playback evidence.
Chrome automation is blocked by an open extension panel; do not bypass that gate.
Google branding and the requested tester were saved, but OAuth remains Testing.
Other integrations must remain credential-gated until their actual provider flows
are verified; a stored connection row is not evidence of a working refresh token.

Primary research:

- [yt-dlp Extractors](https://github.com/yt-dlp/yt-dlp/wiki/Extractors): pacing
  between requests is recommended; OAuth does not enable yt-dlp downloads.
- [yt-dlp FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ): provider restrictions
  need specific diagnosis, not an unconditional promise of proxy recovery.
- [Google audience controls](https://support.google.com/cloud/answer/15549945?hl=en):
  Testing restricts authorization to approved testers. Public access and sensitive
  scope verification are separate deployment/provider-review work.

## Phase 0 — acquisition reliability

- [x] Specific safe error codes/copy: rate limit, challenge, rejected request,
      private, age, geography, unavailable, known transient and unknown.
- [x] Persist one bounded same-path retry for a known transient failure; delayed
      tier escalation; cancellation during backoff; no rights-restriction retries.
- [x] Preserve the last classified failure across worker restarts. Never infer an
      IP block merely because no path is configured or a response is unknown.
- [x] Reuse existing sanitized acquisition health; explain that a probe does
      not guarantee every video. Correct paused/partial-completion progress states.
- [x] Python, worker and app regression tests; typecheck/lint/build gates.

Local verification, 2026-09-06:

- App: typecheck passed; lint zero errors, seven existing Fast Refresh warnings;
  357 tests passed, six skipped; production build passed.
- Worker: 122 tests passed and worker typecheck passed. Python: 27 tests passed.
- Playwright: all 14 existing/new tests passed, including 360px/1280px source
  status, clipping-only marketing and signup with the configured test CAPTCHA.
  This is not a production CAPTCHA/OAuth login verification.
- Isolated PostgreSQL 17: failure RPC contract passed for ten classified errors,
  delayed retry, duplicate callback, cancellation and worker-only execute grants.
  The fixture is deliberately minimal, not proof of full Supabase RLS behavior.
- Existing dev instrumentation emitted hydration attribute mismatches for
  `data-tsd-source` in the root route. Recorded separately from status outcomes.
- Remote migration/deployment is pending. The connected Supabase tool account
  does not own the production project; no changes were made to its unrelated
  project. Owner Chrome automation was blocked by an open extension panel.

Phase 0 code is locally verified; production release acceptance remains open.

## Phase 1 — Exact Cut

- [x] Shared typed range parser: comma/newline paste, MM:SS and HH:MM:SS,
      finite times, end after start, source bounds, overlap warnings, stable row order.
- [x] Existing source wizard mode selector, accessible editable rows, captions
      explicitly off by default, live segment total/quota and canonical clip cap.
- [x] Transactional job creation/reservation: unchanged versioned rights, source
      ownership, concurrency, source-duration cap; bill ceil(sum segment durations),
      with idempotent reservation/commit/release and no browser-selected entitlement.
- [x] Validate source then materialize manual clips/versions idempotently, queue
      previews directly. No full transcript/planning/scenes when captions are off.
- [ ] Optional automatic per-segment transcription: follow-up, not implicitly
      enabled. Users can explicitly enter captions in the existing per-clip editor.
- [ ] Reuse preview/editor/export/retention. Manual list must not show fake scores.
- [ ] E2E five ranges, row editing/reorder/delete, over-limit and durable job/export.
- [ ] Update PRODUCT_SPEC, ARCHITECTURE, ROUTES, CHANGELOG and verification evidence.

Foundation progress (not an executable Exact Cut release):

- Added a controlled, accessible range editor with atomic bulk paste, optional
  labels, stable reorder/delete controls, inline source-bound validation, canonical
  clip-count input, overlapping-range warnings and selected-duration accounting.
  Integer milliseconds are summed before rounding usage up once. Overlaps are
  intentionally charged as separate full ranges, not deduplicated.
- Added candidate origin variants. Existing AI payloads default to `ai_discovery`;
  the planner response remains AI-only and requires real numeric scores.
  `manual_timestamp` and `transcript_selection` accept null scores only.
- Added the candidate-origin/backfill migration and a local PostgreSQL contract
  for legacy preservation, null scores, no fictitious planning run, valid origins
  and finite nonnegative ranges. Test runner is now
  `scripts/test-clip-studio-db.ps1`; both acquisition and origin contracts passed.
- Results-gallery regression tests show no fabricated zero scores or AI rationale
  for selected ranges. AI score filters retain user-selected ranges; title
  regeneration is not offered for unscored ranges lacking planner context.
- At foundation commit `552ed8e`, the new range editor was not mounted in the wizard. API schema projection,
  transactional job creation/metering and worker materialization must be completed
  before exposing the mode. No Exact Cut job/export or production migration has
  been claimed as verified.
- Foundation gates: 402 app tests passed (six skipped), 127 worker tests passed;
  app/worker typecheck and app build passed, lint has the same seven existing
  warnings and no errors. These do not substitute for the pending Exact Cut E2E.

### Executable wiring and edge cases — 2026-09-07

- Re-fetched `origin/main`; it remains `461ba8b`. Existing foundation is preserved.
- Mounted Exact Cut behind `clip_studio_capabilities` (only installed by the final
  accounting migration). The API rejects manual mode before this capability exists.
- Added job-creation fingerprints/workspace serialization, immutable paid source
  contracts, range-only reservation, idempotent materialization and cancellation
  release. No new limit: `maxClipsPerJob` and matching database plans remain canonical.
- Manual validation queues only existing preview tasks and supports sources with
  no audio. Initial source acquisition is once; stored-source reads may repeat.
- Found two editor/accounting gaps during integration: longer saved ranges could
  evade selected-duration metering, and existing browser clip updates lacked an
  UPDATE policy. Added private per-clip paid allowances and a narrow activation RPC.
  Longer saves debit only extra seconds; rounded paid capacity survives repeated
  saves/restores. Source-bound, quota and expiry failures reject changes.
- Skill-driven Supabase review retained empty definer search paths, explicit
  execute grants, membership checks and rollback-safe database enforcement.
  Official reference: https://supabase.com/docs/guides/database/functions .
- PostgreSQL 17 contracts now load actual foundation RLS and the changed migrations
  against local auth/storage stand-ins. Verified 5 ranges -> 5 clips/versions with
  no planning runs; 50 seconds charged for a 600-second source; idempotent replay;
  conflicting retry keys; missing lease/rights/source bounds; foreign access;
  quota/concurrency limits; cancellation release; paid extensions; zero extra
  debit for shorter/restored ranges; cross-clip version rejection. This is not
  the complete hosted Supabase migration/auth/Storage environment.
- Real FFmpeg generated one silent source, rendered five non-keyframe 2-second
  selections through the existing watermarked renderer, and decoded every output.
  The test is opt-in with `TEST_REAL_FFMPEG=1`, `TEST_FFMPEG_PATH` and
  `TEST_FFPROBE_PATH`; its default skip is explicit, not a success assertion.
- Browser UI contracts pass at 360px and 1280px: bulk paste, row edit, overlap
  warning, 5-range payload, selected-duration review and over-limit rejection.
  Screenshots: `output/playwright/exact-cut-360.png` and `exact-cut-1280.png`.
  Dedicated test-only Vite fixture uses mocked provider boundaries and no env
  files; it does not prove authentication, provider acquisition or hosted export.
- Existing 14 Playwright cases also passed. App/worker typecheck, lint, app tests
  and build passed before final documentation refresh; worker suite passed all
  131 tests with real FFmpeg enabled. Final gate counts are recorded in the PR.
- Production not migrated/deployed. Release order: compatible worker, all ordered
  Clip Studio migrations including allowances/capability, regenerated database
  types, then matching web app. Never deploy an AI-only worker after enabling
  the Exact Cut capability. PR #18 remains draft until authenticated export and
  subsequent required phases are verified.
- Final local gates: 413 app tests passed, seven skipped (six pre-existing plus
  the explicitly opt-in real-media test); 131 worker tests passed with real-media
  enabled; both typechecks and production build passed; lint retains seven
  existing warnings and zero errors. All 17 Playwright cases passed. The fixture
  now has a separate Vite dependency cache to avoid interference with the app.
- Release access refreshed: Chrome works again, and the existing GitHub sign-in
  opened the correct `vidrial` production Supabase dashboard as `Mr-Dark-debug`.
  The Supabase MCP connection still belongs to the unrelated account, so it must
  not be used for migrations. No production schema changes were made in this slice.
- Production read-only compatibility check confirmed no leased/running clip tasks,
  no candidate origin column, latest migration `20260823220000`, and zero clips
  UPDATE/ALL policies. This verifies the activation gap against the deployed schema.
- Optional `-Advisors` now runs Supabase CLI security advisors against the isolated
  test database with loopback-only non-TLS connection. No errors; one inherited
  warning for the foundation's `pgcrypto` extension in public. No unrelated
  production extension/schema relocation was attempted.
- Vercel preview for pushed `5f819a6` passed:
  https://vercel.com/prashant-project/vidrial/79ofSh5f5csj16fvCKz7H6HycxEd .
- Deviation: no stream-copy shortcut yet. Current defaults resize and watermark,
  requiring encoding; non-keyframe exact boundaries also require it. Do not
  weaken those guarantees merely to advertise a copy path. Full E2E and the
  deployment gate stay unchecked, so Phase 1 is not declared finished.

### Hosted rollout verification — 2026-09-07

- Rebuilt the actual worker distribution with `bun run build` from the worker
  directory, then restarted the installed FullPipeline home worker while idle.
  Fresh health reports worker ready and acquisition egress healthy. Health reports
  revision `local`, not a Git SHA. This deployment requires the host PC to stay on;
  it is not an always-on cloud service or a Render deployment.
- Applied the five ordered migrations from immutable commit `5f819a6` to the
  correct production project `vifcdussqjhvhurxzdwq` through the owner's SQL Editor.
  Every migration and its history record committed together. Post-deploy query
  confirms all five versions, allowance RLS, installed capability, zero active
  tasks, and denied materialization execution for both anon and authenticated.
- Latest pushed `d75ac5f` has a green Vercel preview:
  https://vercel.com/prashant-project/vidrial/FtFuqFh3ZkkUmymfGGDDTDKANi8t .
  Preview access reached Vercel's authenticator/passkey challenge; the user must
  complete it in Chrome. No MFA workaround or production promotion was attempted.
- Refreshed production security advisors: zero errors and 28 warnings. These
  include intentionally authenticated definer RPCs as well as legacy PUBLIC
  grants; they are not all equivalent to exploitable authorization defects.
  One concrete gap is the internal `dispatch_clip_outbox(integer)` RPC's default
  PUBLIC execute permission. Added an explicit worker-only grant migration and
  actual function ACL/call regression tests (anon denied, browser denied,
  service_role empty-queue dispatch succeeds). No queue transport is mocked as a
  successful production dispatch. Isolated accounting and advisors pass; the
  inherited local pgcrypto-in-public warning remains.
- Hosted five-range upload → preview → edit → export, generated database types,
  and the main/web release remain pending. Production schema/worker readiness
  does not prove that user flow. PR #18 stays draft and unmerged.

## Phase 2 — AI Moments and goal-based discovery

- [ ] Expose existing scores, topic, explanation and real Preview/Edit range/
      Add to clips/Reject actions. Retain existing diversity selection, not a new dedup engine.
- [ ] Structured content-type, audience, platform, target-duration and free-text
      goal inputs feed the existing planner instruction and relevance scoring.

- [ ] Upload a controlled fixture through normal source/rights flow; verify ranked
      results, score/hook/clarity presentation, multiselect export and quota enforcement.
- [ ] Repeat source routing tests for protected HTTPS/RSS. Fix only actual gaps.

## Phase 3 — transcript-first discovery

- [ ] Source player and transcript with click-to-seek and text-selection clipping.
- [ ] Keyword/phrase search, jump to match and create clip from match.
- [ ] Pad and snap ranges using the existing sentence-boundary convention;
      use `transcript_selection` candidates and the ordinary clip pipeline.

## Phase 4 — context repair and topic chapters

- [ ] Suggest, never silently apply, sentence-boundary extensions for selected
      ranges. Missing transcript means no invented context-repair suggestion.
- [ ] Navigable chapter anchors from real candidate topics; accurately describe
      coverage rather than imply sparse top moments cover the entire source.

## Phase 5 — job-only review links

- [ ] Owner-only create/revoke with random scoped capability, hash at rest,
      expiry capped by source retention, safe no-store/referrer controls.
- [ ] Anonymous review session limited to one job; no workspace/billing/profile data.
- [ ] Revalidate link for list, preview bytes and each export request. Revocation
      immediately blocks subsequent access, including existing review sessions.
- [ ] Owner-derived entitlement and original rights on transactional exports;
      idempotent review request, bounded selection, audit actor `review-link visitor`.
- [ ] Compact responsive owner share action and visitor multiselect UI; loading,
      expired/revoked, empty, partial/error and export progress states.
- [ ] DB isolation/revocation/accounting tests and review-flow E2E.

## Release gates

Semantic search and a personalization learning loop are separate later initiatives,
not prerequisites for Phases 0–5. No new semantic-search placeholder will be shipped.

For each phase: `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`,
worker typecheck/tests, Python tests when touched, relevant Supabase/Playwright.
Commit verified slices without rewriting published history. PR describes existing
vs new functionality, deviations, evidence and residual risks. Production claims
require actual deployment revision plus fresh source-to-downloadable-export checks.
Do not mark the overall task complete while provider approval, browser verification,
release deployment or any required feature remains outstanding.
