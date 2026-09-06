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
- [ ] Existing source wizard mode selector, accessible editable rows, captions
  explicitly off by default, live segment total/quota and canonical clip cap.
- [ ] Transactional job creation/reservation: unchanged versioned rights, source
  ownership, concurrency, source-duration cap; bill ceil(sum segment durations),
  with idempotent reservation/commit/release and no browser-selected entitlement.
- [ ] Validate source then materialize manual clips/versions idempotently, queue
  previews directly. No full transcript/planning/scenes when captions are off.
- [ ] Optional bounded per-segment transcription only; rebase caption timings.
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
- The new range editor is not yet mounted in the wizard. API schema projection,
  transactional job creation/metering and worker materialization must be completed
  before exposing the mode. No Exact Cut job/export or production migration has
  been claimed as verified.
- Foundation gates: 402 app tests passed (six skipped), 127 worker tests passed;
  app/worker typecheck and app build passed, lint has the same seven existing
  warnings and no errors. These do not substitute for the pending Exact Cut E2E.

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
