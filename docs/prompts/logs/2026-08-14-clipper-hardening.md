# YouTube Clipper hardening engineering journal — 2026-08-14

## Scope and evidence policy

- Source brief: `C:\Users\ASUS_LAP\.codex\attachments\614f8746-98ea-44fa-a8d4-9f0b4fa2efec\pasted-text-1.txt` (26,445 bytes, read in full at task start).
- Goal: implement and verify the acquisition, scoring/gallery, title/social-copy, caption/editor, publishing, consolidation, and production-verification requirements in §§1–11 of that brief.
- Status vocabulary: **done** means supported by recorded command, test, deployed endpoint, job ID, screenshot, or source evidence. **Partially done** and **blocked** identify the exact missing evidence or operator action.
- Safety boundaries remain unchanged: rights attestation, bounded retries/downloads, no playlists/live/private/age/region bypass, no cookies or browser credentials, no unproxied production fallback, encrypted server-only provider tokens, workspace RLS, immutable object paths and render manifests, and sanitized browser-visible events.
- This journal contains engineering detail. Product analytics and browser-visible events must continue to exclude secrets, proxy URLs, egress IPs, raw provider stderr, cookies, private source URLs, transcripts, and filenames.

## Mandatory audit

### 2026-08-14 — checkout baseline

- Active checkout: `D:\projects\vid-story-prompt`, branch `main`.
- `git status --short --branch` reports `main...origin/main [ahead 2, behind 4]`.
- The checkout already contains extensive modified and untracked blog/SEO work, including `package.json`, `package-lock.json`, `docs/DEPLOYMENT.md`, generated `src/routeTree.gen.ts`, route/style/auth files, `content/`, blog routes, SEO scripts, and Supabase migrations. These changes pre-date this goal and must be preserved. No reset, checkout, rebase, force-push, amend, or squash will be used.
- Origin: `https://github.com/Mr-Dark-debug/vid-story-prompt` for fetch and push.
- `docs/DESIGN_SYSTEM.md`, referenced by the supplied brief, is absent from this checkout at audit start. Brand/UI decisions will use `docs/BRANDIDENTITY.md`, `src/styles.css`, existing components, and any equivalent design-system source discovered during the audit; the missing file will be reported rather than invented.
- No implementation code was changed before this journal was created.

### 2026-08-14 — pre-change quality baseline

- `npm run lint` completed with exit code 0 in 118.7 seconds. It reported seven pre-existing `react-refresh/only-export-components` warnings in `src/components/security/turnstile.tsx` and shared UI primitive files; there were no lint errors.
- `npm run build` stopped during the prebuild content gate with exit code 1 before Vite ran. Exact pre-existing failure: `content/blog/improve-dialogue-audio-for-short-form-video.md: readingTime: Expected 8 minute(s) for 1544 words at 200 words per minute, received 9`.
- The build blocker is in the unfinished blog/SEO work already present at task start, not in YouTube Clipper implementation. It will be kept separate from regressions introduced by this task and repaired only in a way that preserves the user's existing content work.

### Audit checklist

- [x] Read every required architecture/product/security/deployment document in full.
- [x] Inspect production web, authenticated wizard, worker health endpoints, and live Render configuration where credentials permit.
- [x] Determine whether `services/cobalt` is deployed.
- [x] Audit structured AI output, persistence, gallery, titles/social copy, caption presets/animations, and editor parity in current code.
- [x] Fetch and patch-equivalence-check every origin branch; classify stale, retired, or unique work.
- [x] Reproduce the production acquisition failure with a real public YouTube URL and record job/event/health evidence, or record the exact access blocker.
- [x] Research current yt-dlp/YouTube anti-bot guidance, Cobalt deployment/API behavior, ASS/libass caption techniques, and official publishing APIs using current primary sources.

### 2026-08-14 - required document review

- Read in full: `AGENTS.md`, `ARCHITECTURE.md`, `PRODUCT_SPEC.md`, `docs/YOUTUBE_CLIPPER.md`, `docs/VIDEO_WORKER.md`, `docs/JOB_QUEUE.md`, `docs/CONNECTOR_ARCHITECTURE.md`, `docs/CONNECTOR_MATRIX.md`, `docs/AUTOMATIONS.md`, `docs/IMPORT_SECURITY.md`, `docs/OAUTH_SECURITY.md`, `docs/adr/0001-external-video-worker.md`, `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`, `docs/BRANDIDENTITY.md`, and all 2,638 lines of `docs/prompts/youtubeclipper.MD`.
- The current brief was read in full before the audit and reread after the first context compaction, as requested by the operator.
- The implementation must remain inside the existing TanStack Start, Supabase RLS, leased task queue, immutable render-manifest, protected acquisition, connector-registry, and automation-rule architecture. The retired local relay is explicitly outside the current architecture.

### 2026-08-14 - production and configuration baseline

- Public web checks: `https://vidrial.vercel.app` and `/youtube-clipper` returned HTTP 200. Vercel reported the current production deployment ready, created 2026-07-31.
- Worker checks: `https://vidrial-video-worker.onrender.com/healthz` returned HTTP 200 with `status=ok`, `activeTask=false`, `potProviderConfigured=true`, and revision `d146881`; `/readyz` returned HTTP 200 with `ready=true`.
- The protected `/health/proxy` endpoint returned HTTP 401 when called using the locally pulled Vercel production snapshot's worker secret. This indicates that the locally available Vercel snapshot is stale or that the Vercel/Render shared secret is mismatched. No secret value was recorded.
- Render dashboard inspection confirmed `vidrial-video-worker` is a Free-plan Docker service in Frankfurt with 0.1 CPU and 512 MB RAM. The last successful deploy is revision `d146881` from 2026-07-22 even though Auto-Deploy is enabled. Current `origin/main` includes the later internal Python acquisition integration and mobile fixes, so the live worker image is stale.
- Live Render key-presence audit (values intentionally not read or recorded): embedded WARP and Python-acquisition keys are present; `COBALT_API_URL`, `COBALT_API_KEY`, `YTDLP_PROXY_URL`, `WARP_PROXY_URL`, and `WARP_PROXY_HOST` are absent. `LOCAL_RELAY_ENABLED` is still present on the live service even though the relay was retired.
- There is no live `vidrial-cobalt` Render service. `https://vidrial-cobalt.onrender.com/` returned HTTP 404. The repo wrapper exists only under `services/cobalt` with an example blueprint.
- Render has no persistent WARP sidecar. The active free service relies on the two-member embedded WARP pool, matching the reported `0/2 unique` failure. A paid private sidecar or larger worker requires an operator spending decision and was not authorized.
- The installed Vercel CLI is authenticated as `mr-dark-debug`. The deployment is linked to project `vidrial`; no environment values or secrets are included in this journal.

### 2026-08-14 - reproduced acquisition failure

- The authenticated production job list showed three existing real jobs, all in `awaiting_authorised_source`, with zero rendered clips. Safe database inspection confirmed all three have `provider_auth_challenge` and exhausted/dead-lettered acquisition tasks.
- Baseline job `3af7525d-6ec8-4c71-9ddb-5daacb9f2cad` used public YouTube video ID `CXSvKcLovAk`. The production UI showed `Source needed`, a `Worker egress: Checking`/blocked diagnostic, six acquisition attempts, a final WARP attempt, and the manual upload recovery. The UI exposed internal terms including Cloudflare WARP and source adapter.
- Other affected production job IDs: `8422b2de-dfc3-469e-bda7-4b8785091efc` and `e9fae8a0-a9d0-49d3-b10b-2c7f9d2df912`.
- A fresh production job was not created because the free workspace already has three active action-required jobs while its entitlement allows one active job. Canceling or deleting the user's existing jobs merely for an audit would be destructive and was not necessary to reproduce the same real failure.
- The old jobs have no rows in `source_acquisition_attempts`, consistent with their execution predating that migration. Their retention dates expired on 2026-07-25 but the jobs remain action-required; retention handling for terminal/action-required jobs needs verification.

### 2026-08-14 - branch consolidation audit

- Fetched every `origin` ref and checked reachability plus patch equivalence. Every remote branch tip is already reachable from `origin/main`; `git log origin/main..origin/<branch>` and `git cherry origin/main origin/<branch>` produced no unique commits for: `agents/remove-agents-md-restriction`, `codex/auth-mobile-overflow`, `codex/auth-turnstile-reliability`, `codex/connector-platform-production`, `codex/mobile-job-card-containment`, `codex/production-verification-race-fix`, `codex/production-verification-worklog`, `codex/python-youtube-acquisition`, `codex/transcription-response-hardening`, `codex/youtube-free-acquisition-relay`, and `codex/youtube-production-verification`.
- No branch needs a merge or PR. Stale refs are retained as non-destructive audit/history references; deleting them is not required to keep `main` the single deployed branch and would erase useful provenance.
- `codex/youtube-free-acquisition-relay` is the deliberately retired local-device relay. Its historical changes were superseded by `f7f1371` (remove local acquisition relay), `fac5827` (integrate Python YouTube acquisition), and merge commit `2a16f49` (PR #8). It must not be merged or resurrected.
- The local `main` checkout remains ahead two documentation commits and behind four current `origin/main` commits, with extensive pre-existing blog/SEO changes. Consolidation will use normal, non-rewriting Git operations only after preserving and validating that work.

### 2026-08-14 - shipped feature gap audit

- Structured scoring fields and per-candidate `title` already exist in the Zod schema, database, and worker persistence. However, planning sends the whole transcript directly to one LLM request. It lacks the required deterministic segmentation, candidate-window generation, pre-scoring, bounded repair/fallback, and richer diversity selection.
- The job service loads rendered clips but not `clip_candidates`. The current job page shows a placeholder clip grid without candidate scores, explanations, signed previews, score filters/sorting, candidate selection, or real batch actions.
- The editor supports basic timing, aspect ratio, crop choice, caption text, and a minimal version save. Several visible actions are inert. It lacks editable/regenerated titles, social-copy variants, manual focal point controls, safe-area behavior, text overlays, complete audio controls, and working undo/redo/restore/compare.
- The render manifest accepts more concepts than the FFmpeg renderer applies. Current rendering uses scale-down plus black padding, optional subtitles, and a fixed text watermark. It does not honor crop/fill/blur/focal-point, overlay, normalization, or most audio/caption animation choices.
- ASS captions currently emit one dialogue event spanning the whole clip with a hardcoded Liberation Sans style. There is no timed active-word highlight, line reveal, pop animation, selectable licensed font family, or final-render parity with an editor preview.
- YouTube publishing is real and uses official OAuth/resumable upload. TikTok, Instagram, Facebook, and LinkedIn are still non-executable/coming-soon. Automation approval mode exists and must remain the default; new publishers must use the central connector registry and credential-gated OAuth/token storage.

### 2026-08-14 - current primary-source research

- yt-dlp releases: <https://github.com/yt-dlp/yt-dlp/releases>. The worker pin `2026.07.04` is the current release as of this audit; no version bump is needed.
- yt-dlp PO token guide: <https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide>. Current guidance recommends the `mweb` client with a PO-token provider; tokens may be video-bound, so PO tokens are one resilience input rather than a complete egress solution.
- yt-dlp extractor guidance: <https://github.com/yt-dlp/yt-dlp/wiki/Extractors>. It recommends roughly 5-10 seconds between downloads to reduce rate-limit pressure. The current Python engine has retry counts but no conservative request pacing.
- Cobalt API, protection, and self-hosting docs: <https://github.com/imputnet/cobalt/blob/main/docs/api.md>, <https://github.com/imputnet/cobalt/blob/main/docs/protect-an-instance.md>, and <https://github.com/imputnet/cobalt/blob/main/docs/run-an-instance.md>. Third-party use of the hosted service is not appropriate; Vidrial's wrapper must self-host and require its API key.
- FFmpeg/libass sources: <https://ffmpeg.org/ffmpeg-filters.html> and <https://github.com/libass/libass>. ASS karaoke `\\k` timing is centisecond-based; timed dialogue events and `\\fad`/`\\t` tags support baked active-word, reveal, and pop behavior.
- TikTok Content Posting API: <https://developers.tiktok.com/doc/content-posting-api-reference-direct-post> and <https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide>. Direct post requires creator-info checks, `video.publish`, rate limits, audit for public visibility, and verified-domain pull uploads.
- LinkedIn Videos and Posts APIs: <https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api?view=li-lms-2026-03> and <https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-05>. Publishing uses initialize/upload/finalize then Posts API with current version headers and `w_member_social` or approved organization scopes.
- Meta official documentation endpoints returned rate limits during this audit. Implementation must be based on current official Instagram/Facebook Graph documentation before those adapters are claimed ready; no connector will be enabled from memory alone.

## Decisions and experiments

- The immediate acquisition fault is configuration plus deployment drift, not the absence of an acquisition architecture: the worker is seven merged changes behind, has only a two-member shared WARP pool, and has neither the existing Cobalt fallback nor an operator proxy configured.
- The free-tier Cobalt service will be added as an explicit blueprint service, but reliability will be described honestly: free services sleep and Cobalt may face the same datacenter-IP enforcement. The operator-proxy tier remains the durable turnkey configuration point once an operator supplies a clean proxy.
- Product copy will use `Source access`/`Source connection` language and fixed sanitized reason codes. Browser-visible content will not name WARP, Cobalt, proxies, adapters, IPs, or raw provider errors.
- Scoring bands will be consistent across gallery and editor: strong `>=80` uses success, promising `65-79` uses warning, needs-work `40-64` uses danger, and limited `<40` uses muted neutral. These are explanatory clip-strength bands, not performance guarantees.
- Caption fonts will use the already-installed, metrically stable Liberation Sans, Liberation Serif, and Liberation Mono families. They are packaged by Debian and licensed for redistribution; no unlicensed Museum Sans or scraped font asset will be added.

## Implementation record

### Acquisition hardening

- Added conservative bounded yt-dlp pacing to the Python acquisition engine and Docker defaults: 5-second normal sleep, 10-second maximum sleep, and 1-second request sleep. Values outside the documented safety bounds fail validation instead of creating a bypass.
- Added sanitized operator diagnostics for `operator_proxy`, `protected_pool`, and `cobalt`. The worker no longer returns raw egress IPs from `/health/proxy`; browser-visible health maps to fixed, non-technical source-access copy.
- Added the free `vidrial-cobalt` wrapper to the active root Render Blueprint and uses Render `fromService` wiring for its URL and shared key. Existing Blueprint services still require the operator to populate newly introduced `sync:false` values during the first sync.
- Made `YTDLP_PROXY_URL` configuration and paid persistent-WARP-sidecar trade-offs explicit in `.env.example`, `docs/VIDEO_WORKER.md`, and `docs/DEPLOYMENT.md`. No paid resource was created and no unproxied production fallback was introduced.
- Replaced customer-facing WARP/egress/adapter terminology with `Source access`, `Preparing source`, and fixed recovery copy. Focused Python acquisition tests: 16 passed. Focused app acquisition/copy tests: 26 passed. Worker acquisition suite was green before the later full gate.
- The first live Cobalt Blueprint deploy failed closed because the `sync:false` API key required a real operator value; a UUID-v4 secret was generated and stored through Render without recording it. The next deploy exposed a port mismatch (`API_PORT=9000` versus Render's injected `PORT=10000`), so the wrapper now gives the managed-host `PORT` precedence while preserving `API_PORT` for self-hosting.

### Scoring, titles, copy, and results gallery

- Implemented transcript segmentation and bounded 22-62 second candidate windows, deterministic pre-scoring, strict Zod LLM evaluation, one bounded repair, deterministic fallback, overlap/title/transcript/topic diversity, and persisted planning metadata.
- The structured candidate contract now persists standalone, hook, clarity, story, relevance, technical and overall scores, an explanation, suggested title, and validated YouTube Shorts/Instagram/TikTok/LinkedIn copy.
- Added the `20260814020000_clipper_candidate_social_copy.sql` migration and atomic title/copy update RPC. Title regeneration checks session/workspace ownership and never regenerates the entire batch.
- Added a results gallery with signed real previews, consistent score bands, component metrics, expandable explanation/social copy, sorting/filtering, selection, editor links and batch packaging. Batch ZIP creation now clearly requires a completed individual export instead of reaching a worker-only hidden failure.

### Captions, rendering, and editor

- Replaced the legacy render payload with a validated immutable version-2 edit manifest shared by app and worker: timing, aspect/crop/focal/safe area, rich captions and cues, text overlays, audio, title and social copy.
- Final FFmpeg rendering now applies fit/fill/centre/manual focal crop, blur background, licensed-font ASS captions, safe timed overlays, server-derived watermark, gain/mute/fades and optional EBU R128 normalization.
- ASS rendering now bakes exact timed word highlight (`\\kf`), cumulative line reveal, pop transforms, keyword colour, and optional common-profanity masking. Licensed presets are Liberation Sans, Serif and Mono only. SRT/VTT use the same immutable cue boundaries.
- The editor now has real timing, aspect/layout/focal/safe-area controls; caption text, split/merge/download, font, animation, weight, size, position, alignment, colour/background/stroke/shadow, keywords and masking; timed text overlays; full audio controls; title/social copy regeneration; undo/redo; immutable save; restore-as-new; and version comparison. The preview applies the same focal, safe-area, caption, keyword/mask, animation, overlay-timing and audio-manifest concepts that the worker consumes.
- The worker suite after initial scoring/render/editor work passed 18 files and 96 tests, with worker typecheck and build passing. Later focused caption/provider tests passed 2 files/6 tests; both app and worker typechecks passed on the integrated code.

### Multi-channel publishing research and implementation

- Rechecked current official sources: TikTok Direct Post and Creator Info; Meta's official `fbsamples/reels_publishing_apis` code and official Meta Postman collections; LinkedIn versioned Videos and Posts APIs. Meta Graph `v25.0` is the current release in August 2026; LinkedIn requests pin a configurable `YYYYMM` header (`202605` default).
- Promoted Facebook Pages, Instagram Professional, TikTok and LinkedIn from simulated/planned cards to credential-gated beta definitions in the central registry. Missing web credentials keep them non-executable; missing worker credentials fail closed.
- Extended the existing connector OAuth service, exact generic callback, PKCE/signed state, encrypted `oauth_connections` token store, capability checks and provider identity lookup. Meta stores only Page/Instagram destination ids and labels, never Page tokens. TikTok creator and LinkedIn person destinations come from official identity endpoints.
- Added `20260814030000_multichannel_publishing.sql`, extending the existing `publishing_jobs` table/queue with platform, encrypted connection reference, authorised target, review mode, provider options and approval timestamp. It does not create a parallel publication system.
- Added a review-first social publishing panel backed by completed exports and real authorised targets. It refreshes TikTok creator options, keeps unaudited clients `SELF_ONLY`, and does not render a publish action when no destination is connected. The existing automation `approval_mode=manual` default remains unchanged; automatic is still an explicit per-rule option with separate destinations.
- Added worker adapters for Facebook Reels start/binary/finish, Instagram signed-URL container/poll/publish, TikTok creator-query/init/chunk/status, and LinkedIn initialize/multipart/finalize/Post. Upload sessions are encrypted for retry where the provider returns resumable URLs; queue failures update a sanitized publication state.
- Operator prerequisites are recorded in `docs/CONNECTOR_MATRIX.md` and `docs/DEPLOYMENT.md`: developer app registration, exact callbacks, requested scopes/products, platform review/audit, account/Page linkage, and the same encryption key on web/worker. No real provider credential or live post was available, so live publishing is not claimed.
- Integrated focused verification: app and worker typechecks passed; OAuth/registry/social-panel tests passed 4 files/13 tests; caption/social-worker tests passed 2 files/6 tests.

### Integrated quality and editorial gate

- Repaired twelve pre-existing article `readingTime` declarations to match the repository's deterministic 200-words-per-minute rule. No article body was padded or shortened to satisfy the validator.
- The live external-link audit initially found one genuine 404 in `how-to-write-youtube-shorts-hooks.md`. The dead secondary source was removed from both the article metadata and paired research note; the article retains stronger official YouTube sources. The rerun checked 219 unique URLs with 0 failures.
- Added the 42 missing post-launch review records as honest `REVISE` decisions, not fabricated publication approvals. Each record explicitly keeps its article `draft: true`, records the automated evidence available now, and requires a fresh claim-by-claim primary-source and product-state review before publication. The existing 18 launch reviews remain PASS.
- `npm run content:validate`: passed for 60 articles, 60 paired research notes and 60 review records. `npm run content:audit`: 60 articles, 0 blockers, 0 revisions. `npm run build`: passed through the unchanged content prebuild gate and full Vite/Nitro client/server build.
- `npm run typecheck`: passed. `npm run lint`: exit 0 with the same seven Fast Refresh warnings recorded at baseline and no errors. `npm test`: 72 files passed, 1 skipped; 307 tests passed, 6 skipped. `npm run worker:test`: 19 files and 99 tests passed. Worker typecheck/build passed. Python acquisition: 16 tests passed.
- `npm run test:e2e`: 8/8 Chromium tests passed. This covers the public clipper demonstration, protected-route return URL, real Cloudflare Turnstile test-key completion before account creation, crawlable blog index/search, article metadata/JSON-LD, real 404s, discovery endpoints, and a 360-pixel mobile overflow check.
- A merged-gate run exposed a React hydration warning even though Playwright exited green: Markdown heading ids were assigned through a mutable render-order counter, which is unsafe under concurrent React rendering. Heading metadata now records source lines and `ArticleBody` resolves ids by immutable source position. A duplicate-heading regression test passes, and the 8/8 E2E rerun is free of the hydration mismatch.
- Supabase local integration tests remain skipped because Docker/Podman is unavailable on this host. Linked checks passed: migration dry-run lists four pending migrations and `supabase db lint --linked --level warning` exits 0 with two pre-existing unused-variable warnings.
- Applied the four pending migrations to the linked production Supabase project. Post-apply lint found that the blog-feedback function referenced `public.digest` while pgcrypto is installed under `extensions`; because the original migration was already applied, a forward-only `20260814040000_fix_blog_feedback_digest_schema.sql` migration corrected the qualified call. The remote ledger now matches all 27 local migrations. Final linked lint contains only the two pre-existing unused-variable warnings and no errors.

### Production deployment verification and startup correction

- Merged and pushed the integrated implementation to `main` without rewriting history. Vercel deployed the web application successfully, and the root Render Blueprint created the real `vidrial-cobalt` service.
- Stored a generated UUID-v4 Cobalt API key in Render without printing or recording it. The first Cobalt deploy failed closed until this required secret existed. A second deployment exposed a managed-port mismatch; `services/cobalt/entrypoint.sh` now gives Render's injected `PORT` precedence. The corrected Cobalt service reached `Live`, returned HTTP 200 from its root endpoint, and rejected an unauthenticated API request with `error.api.auth.key.missing`, confirming the protection boundary.
- Two authenticated Cobalt extraction probes used ordinary public YouTube videos (`CXSvKcLovAk` and `jNQXAC9IVRw`). Both reached the service but returned the sanitized provider result `error.api.youtube.login`. This proves the fallback is deployed and authenticated, but also proves that a second free Render datacenter service does not solve YouTube's network enforcement on its own. No success is fabricated.
- Render's first current-worker deployment failed after the image built: embedded WARP member 0 timed out, and `start.sh` exited status 1 before the Node worker could bind its public port. The live service therefore continued reporting stale revision `d146881`. Embedded WARP is a degraded optional acquisition tier, so startup now logs sanitized registration/process/connect failures, stops the failed member, and continues with configured fallbacks instead of terminating the service. Its bounded startup wait is reduced from 60 to 20 seconds. Shell syntax validation passed; worker typecheck/build passed; all 19 worker test files and 99 tests passed.
- The corrected worker deployed as revision `ae2a4f1`; `/healthz` returned HTTP 200 with `pythonAcquisitionReady=true`, and `/readyz` returned HTTP 200. The Vercel and Render worker bearer secrets were mismatched; both environments were synchronized to one newly generated strong secret without displaying it, and each service was redeployed. The protected `/health/proxy` endpoint then returned HTTP 200 with sanitized tier evidence: Cobalt `ready`, Python acquisition ready, embedded protected pool unavailable, and operator proxy unconfigured.
- Production visual verification confirmed the new fixed copy on the authenticated baseline job: `Source access: Blocked`, `Preparing source`, and a provider-neutral explanation. Stored historical event messages remain sanitized at render time but preserve older event wording in the database for audit provenance.
- The database RPC already permits exactly one bounded `forceProxy` retry when a prior acquisition task has not used it. The job page hid this safe action whenever a job was already `awaiting_authorised_source`, preventing recovery after operator configuration improved. The UI now exposes `Retry automatic source access` for that eligible state; RPC ownership, retry bounds, active-task checks, and rights attestation remain unchanged.
- The eligible production job `8422b2de-dfc3-469e-bda7-4b8785091efc` (public video `yI8cL_PSkNI`) used that real UI action. The RPC queued exactly attempt 6/6, the current worker selected Cobalt, and the attempt failed closed in 1.6 seconds with `cobalt_unavailable`; it did not fall back to direct production egress. This revealed that Render's `fromService` API-key reference had not inherited the Cobalt key supplied after Blueprint creation. The existing Cobalt key was synchronized into the worker without display and the worker was redeployed.
- That retry also exposed two old implementation phrases still emitted by the 2026-07-19 database function. Forward migration `20260814050000_sanitize_source_acquisition_events.sql` changes future messages to provider-neutral source-connection language and updates the exact historical fixed-copy rows. It does not remove attempt, tier, or error-code evidence from the operator-only acquisition records.
- The original Cobalt health check only performed a root GET, which could be green even when the worker key was wrong. It now sends a bounded, harmless invalid-link POST with API-key authentication. A normal structured unsupported-link response proves the endpoint and key are accepted; `error.api.auth.key.*` becomes sanitized `cobalt_auth_rejected`; malformed/oversized/5xx responses remain `cobalt_unreachable`. No URL, credential, or provider body enters the diagnostic response.

## Final completion report

### §4 — YouTube source acquisition: partially done

- **Done:** the production worker is current (`dc85033`), starts even when embedded WARP cannot connect, keeps direct production egress disabled, applies conservative yt-dlp pacing, exposes sanitized per-tier diagnostics, and has a real authenticated Cobalt fallback. `GET /healthz` and `/readyz` return HTTP 200; authenticated `/health/proxy` returns HTTP 200 with Python acquisition ready and Cobalt `cobalt_ready`. The worker/Vercel bearer secret and worker/Cobalt API key are synchronized without either value being exposed.
- **Done:** root `render.yaml` provisions `vidrial-cobalt`; the service is live at `https://vidrial-cobalt.onrender.com`, reports Cobalt 11.7.1, requires its API key, and is wired to the worker. Operator-proxy and paid-sidecar activation are documented and require configuration rather than a rewrite. Customer copy now says `Source access`, `Preparing source`, and provider-neutral recovery text. Migration `20260814050000` removes the remaining internal acquisition phrases from fixed product events.
- **Production evidence:** baseline job `3af7525d-6ec8-4c71-9ddb-5daacb9f2cad` reproduced the original `0/2` failure. Eligible job `8422b2de-dfc3-469e-bda7-4b8785091efc` used the newly exposed bounded retry on production; the RPC queued attempt 6/6 and the current worker selected Cobalt. That attempt revealed and led to correction of the worker/Cobalt key mismatch. Two separate authenticated direct Cobalt probes for public videos `CXSvKcLovAk` and `jNQXAC9IVRw` reached Cobalt but returned YouTube's `error.api.youtube.login` challenge.
- **Not done:** automatic YouTube acquisition does not yet succeed “most of the time” from the current free Frankfurt datacenter paths. The evidence shows YouTube rejects both free Cobalt/Render egress and the unavailable embedded WARP path. A clean operator-supplied residential/rotating `YTDLP_PROXY_URL`, or an approved paid persistent sidecar with verified fresh egress, is required to close this reliability objective. No proxy subscription or paid Render resource was purchased without operator authority, and no successful acquisition was fabricated.

### §5 — AI scoring and results gallery: done

- Implemented bounded transcript segmentation, candidate windows, deterministic pre-scoring, strict Zod LLM evaluation with one repair, deterministic fallback, deduplication and topic/time diversity selection. Persisted standalone, hook, clarity, story, relevance, technical and overall scores plus explanations.
- Implemented real signed previews, consistent semantic score bands, sort/filter/selection, expandable explanations and per-metric evidence in the job gallery. App typecheck passed; full app suite passed 72 files plus one skipped, 307 tests plus six skipped; the integrated production build is Ready on Vercel.

### §6 — per-clip titles and social copy: done

- Suggested titles and validated YouTube Shorts, Instagram, TikTok and LinkedIn copy are persisted per candidate and displayed in gallery/editor. Title regeneration is scoped to one owned candidate through an atomic RPC and does not rerun the batch. Migration `20260814020000_clipper_candidate_social_copy.sql` is applied to production.
- Focused OAuth/gallery/social tests passed as part of the recorded app and worker gates. A live candidate could not be produced for visual production evidence because §4 remains blocked upstream; this is called out under §10.

### §7 — caption fonts and animation: done

- Immutable manifest v2 supports licensed Liberation Sans/Serif/Mono presets, size/weight/position/alignment/background/stroke/shadow, keyword and active-word styling, profanity masking, and timed cues. Final FFmpeg/libass output implements word karaoke, line reveal and pop animations; browser preview uses the same manifest concepts.
- Worker typecheck/build passed and the final worker suite passed 19 files/100 tests. No unlicensed Museum Sans or scraped font asset was added.

### §8 — clip editor parity: done

- Implemented timing, 9:16/1:1/16:9, fit/fill/centre/blur/manual focal point, safe area, timed overlays, caption cue editing/download, gain/mute/fades/normalization, title/social copy editing, undo/redo, immutable save, restore-as-new and version comparison. Worker rendering applies crop/focal/blur, overlays, captions, audio controls and server-derived watermark from the same immutable manifest.
- App typecheck/lint/tests/build and worker typecheck/tests/build passed. Final production editor rendering could not be exercised without a source clip; that upstream evidence gap is recorded under §10 rather than hidden.

### §9 — multi-channel publishing: partially done

- **Done:** Facebook Pages, Instagram Professional, TikTok and LinkedIn use the central connector registry, existing PKCE/signed-state/exact-callback/encrypted-token architecture, credential-gated UI, review-first defaults and the existing publication queue. Worker adapters implement the current official upload/post flows. Migration `20260814030000_multichannel_publishing.sql` is applied to production.
- **Blocked externally:** no Meta/TikTok/LinkedIn developer credentials, platform review/audit or authorised destinations were available; the UI therefore remains honestly non-executable. No live post or provider approval is claimed. The exact app-registration, scopes/products, review and account-linkage steps are in `docs/CONNECTOR_MATRIX.md` and `docs/DEPLOYMENT.md`. YouTube publishing also could not run because no final export existed.

### §10 — end-to-end production verification: partially done

- **Quality gate:** `npm run typecheck` passed; `npm run lint` passed with the same seven Fast Refresh warnings and zero errors; `npm test` passed 307 tests with six skipped; `npm run build` passed; worker typecheck/build passed; final worker suite passed 100 tests; Python acquisition passed 16 tests; Playwright passed 8/8; content validation passed 60/60/60; content audit reported zero blockers/revisions; 219 external links passed. Local Supabase integration remained unavailable because Docker/Podman is not installed.
- **Database/deployment:** all 28 local migrations match production. Linked database lint has no errors and only two pre-existing unused-variable warnings. Vercel production deployment `https://vidrial-h0cw8p9fj-prashant-project.vercel.app` is Ready and aliased to `https://vidrial.vercel.app`. Render serves worker revision `dc85033`; `/healthz`, `/readyz` and authenticated `/health/proxy` all return HTTP 200. Cobalt is live and authenticated.
- **Live browser evidence:** authenticated desktop production showed the provider-neutral source-access UI and the newly deployed bounded retry on job `8422b2de-dfc3-469e-bda7-4b8785091efc`. The real retry reached the current worker and created a persisted Cobalt attempt. Local Playwright verified the public/auth flows and 360-pixel overflow containment; a real 360-pixel production browser emulation was not separately captured.
- **Blocked end-to-end:** the live job stopped at source acquisition because YouTube challenges the available free datacenter paths. Therefore there is no honest production evidence for transcription, scored candidate previews, two rendered caption combinations, final download, or publishing. Unblock §4 with a clean operator proxy or approved paid egress, then run one fresh rights-attested job through the already-deployed downstream pipeline and provider publishing where credentials exist.

## Round 2 — 2026-08-14 — durable home acquisition and first real end-to-end run

### Kickoff and execution contract

- Read the Round 2 brief and this complete continuous journal before making runtime or repository changes. Context compaction occurred while the brief was first being read, so the brief was reread in full afterward as explicitly required by the operator.
- `main` started clean and synchronized with `origin/main` at `6e94e4f`. Docker was absent from `PATH`; `winget` and `wsl.exe` were present. The first combined `wsl --status`/version/list probe did not return within 34 seconds and was terminated by the command timeout; no prerequisite state is inferred from that timeout.
- The implementation plan is `docs/superpowers/plans/2026-08-14-home-worker-e2e-publishing-prep.md`. The operator explicitly requested autonomous inline execution through every phase without confirmation pauses, so no execution-choice prompt or subagent dispatch is used.
- The home-worker design is Docker Compose with an ignored local secret file, `NODE_ENV=development`, `ENABLE_EMBEDDED_WARP=false`, localhost-only health exposure, `restart: unless-stopped`, and a current-user Windows logon task that starts Docker Desktop and reconciles the Compose project.

### Docker prerequisite attempt — operator action required

- Windows 11 reports `HyperVisorPresent=True` and `CsHypervisorPresent=True`; `systeminfo.exe` independently reports that a hypervisor is detected. The earlier processor WMI flags were therefore not treated as proof that BIOS virtualization is disabled.
- `winget` resolved Docker Desktop `4.86.0`, downloaded it from Docker's official Windows distribution endpoint, and verified the installer hash. Installation reached `Starting package install...` and explicitly reported that administrator approval was required.
- Windows launched the secure UAC consent process. The unattended installer could not approve that secure-desktop prompt and was terminated after 164 seconds; winget returned `4294967291`. A follow-up check confirms Docker Desktop is not installed and no installer/consent process remains.
- Per the Round 2 brief, no privilege workaround was attempted. The operator must rerun the Docker Desktop installation and click **Yes** on the UAC prompt. After that one approval, execution can resume at engine startup/build without repeating the audit or plan.
