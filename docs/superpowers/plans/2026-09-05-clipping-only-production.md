# Clipping-only product and production reliability

## Scope and execution plan

The product owner removed standalone online video editing from Vidrial. Preserve source media and saved history; retire the editor's pages and navigation, not customer data. Keep clip-specific boundaries, captions, framing and export settings.

1. Inspect deployed app, Google OAuth configuration, worker tasks and storage failures.
2. Correct acquisition-independent failures: retryable transcription failures and large private artifact uploads.
3. Replace misleading progress with actual pipeline stages and completion counts, backed by Realtime plus polling.
4. Remove editor/project/template navigation and executable editor routes; redirect legacy links.
5. Reposition homepage, features, workflow, use cases, roadmap, documentation, authentication branding and pricing around clipping. Derive pricing capacity from `PLAN_ENTITLEMENTS`; keep paid plans explicitly unavailable.
6. Verify types, lint, app/worker suites, production storage checks, browser responsiveness and redirects before publishing.
7. Publish a normal merge commit (no rewritten Lovable history), verify deployment, then verify an authorised source through to a downloadable export.

## Evidence and decisions

- The previously failing Blender source was acquired successfully by the residential home worker. The later Groq Turbo transcription request returned HTTP 500, while the same audio succeeded with `whisper-large-v3`. Retry that model once for retryable provider failures; do not hop models for rate limits, authentication failures or cancellation.
- A full-source proxy was generated but had no downstream consumer in the clipping pipeline. Stop enqueueing it for new jobs; retain its legacy handler. This avoids a large, unnecessary encode/upload that could leave misleading failure text after useful work succeeds.
- Supabase recommends resumable uploads for files above 6 MB: <https://supabase.com/docs/guides/storage/uploads/resumable-uploads>. Use 6 MiB TUS chunks and the direct storage hostname, with both bearer authorization and the project API-key header. Initial live test returned `400 AccessDenied` without the latter; adding it produced a successful round trip. TUS does not remove the project's per-object storage limit.
- Large worker-only artifacts retain immutable chunk manifests; browser previews/exports remain ordinary seekable media. Bound manifest reads and part sizes before writing, and handle partial filesystem writes.
- Google OAuth is a separate blocker. The inspected project was External/Testing with one test user, incomplete application URLs, unrelated Gmail scope declarations and no YouTube scope declarations. Do not delete scopes that may belong to another product. Code limits new YouTube consent requests to required scopes and disables aggregation of previously granted permissions.
- Google documents Testing restrictions and production verification: <https://support.google.com/cloud/answer/15549945?hl=en> and <https://support.google.com/cloud/answer/13461325?hl=en>. A code deployment cannot substitute for Google publishing/verification approval.
- Groq model documentation: <https://console.groq.com/docs/speech-to-text>.

## Verification log

- Production storage: 7,340,032-byte preview uploaded with TUS, downloaded, SHA-256 matched.
- Production storage: 47,186,944-byte worker artifact uploaded as a manifest plus private chunks, reconstructed, SHA-256 matched.
- Exact randomly named verification objects were removed after checks. No existing media or job retention was changed.
- Final app suite: 329 passed, 6 skipped. Worker suite: 112 passed. App and worker typechecks/builds passed. Lint: no errors, seven existing Fast Refresh warnings.
- Browser checks: new clipping-only public routes fit 360 px and 1280 px; editor documentation returns 301 to the clipping guide and is absent from the sitemap.
- First full Playwright run: 10 passed, one old blog assertion expected only two JSON-LD objects although the root already includes Organization and WebSite. Updated the assertion to require the four exact schema types. A concurrent run hit a blog hydration timeout; the full sequential run passed all 11 tests, including the real Turnstile dummy-key flow.
- Chrome production inspection confirmed the old editor homepage was still deployed before publication. Further authenticated inspection was blocked by an extension panel; browser access must be restored for that verification.

## Release gates and residual risks

Do not describe all integrations or YouTube E2E as verified until an authenticated production clipping job produces a downloadable export on the new worker revision. Expired historical jobs are diagnostic evidence, not safe retry fixtures. Keep actual Google publishing/verification status and any owner-action requirements visible in the handoff.

The residential operator worker is not a guaranteed always-on free cloud service. Network restrictions can still reject individual YouTube sources; changing implementation language does not change egress. No paid infrastructure or new paid dependency was added. Supabase plan/file limits still apply to browser-accessible final exports.

Historical editorial articles remain available; product CTAs now lead to clipping. Standalone editor implementation history and database records are preserved for recovery, but retired route components cannot expose the editor UI. The retained legacy `/clips/:id/edit` URL now opens clip settings without a timeline.
