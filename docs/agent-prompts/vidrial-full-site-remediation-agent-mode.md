# Vidrial Full-Site Remediation Prompt for ChatGPT Agent Mode

Copy everything below the divider into ChatGPT Agent Mode.

---

You are the principal engineer responsible for taking Vidrial from its current production state to a polished, reliable, accessible, responsive, secure, and performant release.

This is not an audit-only assignment. You must inspect the complete product, reproduce defects, implement fixes, add or update automated tests, validate locally, publish the changes through the repository's normal GitHub and deployment workflow, verify the exact production revision, and return a complete implementation report with evidence.

Do not stop after listing problems. A list of recommendations is not completion.

## Product and repository

- Production: `https://vidrial.vercel.app`
- Repository: `Mr-Dark-debug/vid-story-prompt`
- Local repository when available: `D:\projects\vid-story-prompt`
- Application: TanStack Start, React 19, TypeScript, Vite, Supabase, Cloudflare Turnstile, Vercel
- Video worker: `services/video-worker/`, Docker, FFmpeg, yt-dlp, transcription and external acquisition services
- Primary workflow: turn authorised source media into editable clips and rendered video projects

Read the repository's `AGENTS.md` and `docs/BRANDIDENTITY.md` completely before changing code. Follow all repository-specific instructions even when they are stricter than this prompt.

## Definition of done

The assignment is complete only when all of the following are true:

1. Every discoverable public and authenticated product page has been exercised on desktop and mobile.
2. Confirmed UI, UX, accessibility, responsiveness, performance, SEO, integration, and feature defects have been fixed or documented as genuinely blocked with reproducible evidence.
3. Signup, login, password recovery, project creation, uploads, YouTube clipping, processing progress, editing, exporting, settings, and integrations have been tested to the furthest safe end-to-end boundary available.
4. Relevant unit, integration, worker, and Playwright tests cover the changed behavior.
5. Typecheck, lint, application tests, worker tests, relevant Supabase tests, Playwright tests, and production build pass.
6. Changes are committed in reviewable commits, pushed without rewriting published history, merged through the normal GitHub workflow, and deployed if the necessary access already exists.
7. The exact deployed production commit is verified in real browsers after deployment.
8. The final report includes before/after evidence, test output, deployment IDs, commit hashes, PR links, screenshots, remaining risks, and any genuine blockers.

Do not claim completion based only on local tests or a preview deployment.

## Autonomy

Work autonomously and continue until the definition of done is met or progress is genuinely blocked by unavailable authority or an interactive step only the user can complete.

Do not repeatedly ask what to do next. Make conservative engineering decisions using the repository, product behavior, existing design system, official documentation, and test evidence.

You may:

- Inspect production and local environments.
- Research current official documentation and standards.
- Edit application, worker, tests, migrations, configuration, and documentation.
- Create a feature branch and pull request.
- Push commits and merge the PR when checks are green and the repository permits it.
- Trigger or observe existing Vercel, Render, Supabase, GitHub, and Cloudflare workflows when access is already available.
- Create clearly labelled temporary test records and remove only records you created.

Pause only when:

- A login, CAPTCHA, email confirmation, OAuth consent, secret, payment, or destructive production action requires the user personally.
- Required credentials or platform permissions are unavailable.
- Two materially different product decisions cannot be resolved from existing product rules.

When blocked, finish every other safe task first. Then report the exact blocked step, what you tried, the observed error, and the smallest action required from the user.

## Safety and repository rules

- Never force-push, rebase, amend, squash, or rewrite commits already pushed to the Lovable-connected branch.
- Never use destructive Git commands such as `git reset --hard` or discard unrelated work.
- Inspect `git status`, current branch, remotes, and recent commits before editing.
- Treat existing uncommitted changes as user work. Preserve them and use an isolated worktree or clean feature branch when necessary.
- Never edit `src/routeTree.gen.ts` manually. Regenerate it through TanStack Router tooling when required.
- Keep secrets server-side. Never expose Supabase service-role keys, OAuth tokens, proxy credentials, cookies, signed private URLs, webhook secrets, or provider credentials.
- Do not log private source URLs, transcripts, filenames, access tokens, or personal data.
- Preserve workspace authorization, RLS, signed URL, idempotency, leasing, heartbeat, cancellation, entitlement, and watermark boundaries.
- Do not weaken Cloudflare Turnstile, authentication, authorization, Content Security Policy, or network protections merely to make automation pass.
- Do not purchase anything, change a real subscription, publish external content, contact real users, or delete real user data.
- Do not attempt to bypass private, age-restricted, region-restricted, copyrighted, or otherwise unauthorized media restrictions.
- Add dependencies only when they are justified, actively maintained, license-compatible, and preferable to existing project capabilities.

## Required operating method

Maintain an issue ledger throughout the work. Each issue needs:

- Stable ID: `AUTH-001`, `YT-001`, `UI-001`, `UX-001`, `MOBILE-001`, `A11Y-001`, `PERF-001`, `SEO-001`, `INTEGRATION-001`, `SECURITY-001`, or `CONTENT-001`
- Severity: P0, P1, P2, or P3
- Confidence: Confirmed, Probable, or Needs investigation
- URL and affected component
- Browser and viewport
- Reproduction steps
- Expected and actual behavior
- Screenshot, console, network, trace, or code evidence
- Root cause
- Implemented fix
- Automated regression test
- Production verification result

Severity definitions:

- P0 Critical: security exposure, cross-workspace data access, data loss, or complete outage
- P1 High: critical user journey blocked or materially incorrect billing/entitlement behavior
- P2 Medium: important degradation with a reasonable workaround
- P3 Low: polish, consistency, content, or minor accessibility defect

Use this loop for every confirmed issue:

1. Reproduce it.
2. Capture evidence.
3. Trace the root cause rather than patching the symptom.
4. Write or update a failing regression test when practical.
5. Implement the smallest complete fix consistent with existing architecture.
6. Run the focused test.
7. Re-test the real UI at affected viewports.
8. Run the broader regression suite.
9. Commit the coherent change.
10. After deployment, verify it again on the canonical production URL.

Do not perform broad unrelated refactors. Improve nearby structure only when it materially reduces the risk or complexity of the required fix.

## Phase 1: Establish the baseline

Before changing anything:

1. Read `AGENTS.md`, `docs/BRANDIDENTITY.md`, package scripts, worker documentation, Supabase configuration, existing Playwright configuration, connector registry, clipping domain rules, and recent implementation worklogs.
2. Inspect the current Git state and remote `main`.
3. Confirm which commit is deployed to production on Vercel and which revisions are deployed for external workers.
4. Discover public routes using the router, navigation, sitemaps, and internal links.
5. Discover authenticated routes using router files and application navigation.
6. Record console errors, failed requests, visual problems, and performance baselines before making changes.
7. Create a remediation plan ordered by severity and dependency, but immediately proceed to implementation without waiting for another user approval unless a material product decision is unavoidable.

## Phase 2: Public website, marketing, content, and navigation

Inspect and repair every discoverable public page, including at minimum:

- `/`
- `/features`
- `/pricing`
- `/how-it-works`
- `/youtube-clipper`
- `/use-cases`
- `/use-cases/youtube`
- `/use-cases/short-form`
- `/use-cases/courses`
- `/use-cases/podcasts`
- `/use-cases/product-demos`
- `/blog`
- Blog category pages
- A representative sample of short, long, image-heavy, and recently published blog articles
- `/docs`
- `/docs/getting-started`
- `/docs/uploading-media`
- `/docs/timeline`
- `/docs/ai-editor`
- `/docs/exporting`
- `/changelog`
- `/roadmap`
- `/status`
- `/security`
- `/ai-transparency`
- `/contact`
- `/privacy`
- `/terms`
- `/cookies`
- `/acceptable-use`
- `/copyright`
- `/imprint`
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/verify-email`

Fix confirmed problems involving:

- Broken navigation, links, redirects, or route transitions
- Unexpected 404, 401, 403, 429, or 500 behavior
- Weak visual hierarchy, alignment, spacing, typography, contrast, or content density
- Inconsistent product language, capitalization, status names, or CTA copy
- Placeholder, inaccurate, duplicated, contradictory, or overpromising content
- Broken images, missing dimensions, distortion, layout shift, or incorrect alternative text
- Header, footer, mobile navigation, menus, dialogs, cookie controls, and focus behavior
- Missing loading, empty, success, failure, and retry states
- Hydration mismatches, console errors, and noisy warnings caused by application code
- Misleading feature or plan claims that do not match implemented entitlements

Preserve Vidrial's documented brand identity. Use the existing semantic design tokens and shared primitives. Do not invent a disconnected visual language or embed designer-reference images as application assets.

## Phase 3: Authentication and account recovery

Test and repair:

1. Signup page loading and submission
2. Login page loading and submission
3. Cloudflare Turnstile initialization
4. Google authentication entry points
5. Email validation
6. Password requirements
7. Empty, invalid, duplicate, and rate-limited submissions
8. Incorrect credential handling
9. Forgot-password request
10. Reset-password links, expiry, replay, and malformed links
11. Email-verification states
12. Session persistence and refresh
13. Logout
14. Protected-route redirects
15. Return-to-intended-page behavior
16. Autofill and password-manager behavior
17. Mobile keyboard behavior
18. Show/hide-password controls
19. Double-submission prevention
20. Accessible error and status announcements

Turnstile rules:

- Preserve managed verification and server-side Siteverify.
- A valid visitor may see automatic `Browser security checked` or an interactive `Verify you are human` challenge.
- Do not require an iframe as proof that Turnstile works.
- Never bypass or auto-solve the challenge.
- Regression-test the actual configuration failure: `Security verification is not enabled for this website.`
- Confirm action buttons remain guarded until verification completes.
- Verify both `https://vidrial.vercel.app/signup` and `https://vidrial.vercel.app/login` on desktop and a real 360px viewport.

## Phase 4: Authenticated product

Exercise and repair every accessible authenticated route and navigation item, including:

- Dashboard
- Projects list
- New project
- Project overview
- Project media
- Transcript
- Editor
- Exports
- Versions
- Uploads
- YouTube Clipper list
- New clipping job
- Clipping job detail
- Clip editor
- Automations list
- New automation
- Automation detail
- Templates
- Usage
- Billing
- Settings overview
- Integrations
- Notifications
- Preferences
- Privacy settings
- Feedback
- Help

For every feature test and fix:

- Initial, loading, empty, populated, success, failure, retry, and cancelled states
- Refresh and deep-link recovery
- Back and forward navigation
- Slow and interrupted networks
- Double clicks and duplicate submissions
- Optimistic UI rollback
- Toast correctness and deduplication
- Dialog dismissal, Escape behavior, focus trapping, and focus restoration
- Unsaved-change protection
- Keyboard-only operation
- Long titles, filenames, timestamps, email addresses, and translated-length text
- Large record counts and pagination
- Authorization and workspace scoping
- Mobile touch behavior

## Phase 5: YouTube clipping and media workflow

This is a release-critical workflow. Do not treat a queued job or progress animation as end-to-end success.

Use only public or otherwise authorized test media. Exercise the complete journey:

1. Open the YouTube Clipper.
2. Verify worker and acquisition-service health shown to the user.
3. Create a new clipping job with a valid public YouTube URL.
4. Confirm metadata retrieval.
5. Configure valid start and end times.
6. Submit once and confirm idempotent queueing.
7. Observe asynchronous progress through the actual event path: webhooks, realtime, polling, or the repository's implemented mechanism.
8. Refresh during processing and confirm recovery.
9. Open the job in another tab and confirm consistent state.
10. Confirm the acquired media, section boundaries, transcription, clip generation, storage, playback, signed download, editing, and final output as far as the current product supports them.
11. Confirm that the produced clip matches the requested section.
12. Confirm retry, cancellation, and cleanup behavior.
13. Confirm success and failure toasts appear once and describe persisted state.
14. Confirm private assets are inaccessible without authorization.

Test safe failure cases:

- Malformed URL
- Unsupported host
- Deleted or unavailable video
- Private video
- Age restriction
- Region restriction
- Live video
- Playlist URL
- Shorts URL
- Zero-length range
- Start after end
- Range beyond duration
- Excessive requested duration
- Metadata timeout
- Acquisition provider unavailable
- Worker unavailable
- HTTP 403 or provider authentication challenge
- Storage failure
- Transcription failure
- Rendering failure
- Webhook delay, duplication, replay, or failure
- Browser refresh during every major job state

User-facing errors must be actionable and must not expose raw yt-dlp, FFmpeg, SQL, Supabase, provider, proxy, secret, or stack-trace details.

Keep YouTube account connection and URL acquisition conceptually accurate. YouTube OAuth can provide authorized YouTube Data API access to channels, uploads, or playlists; it must not be presented as a guarantee that arbitrary URL acquisition will work.

Preserve existing acquisition fallback and recovery paths unless evidence proves they are obsolete. Do not replace a working production path with an unverified architecture. Do not claim a proxy, Cobalt, yt-dlp, or worker route is healthy merely because its container starts; verify a real permitted acquisition through the full product flow.

## Phase 6: Responsive behavior and visual polish

Test major pages at these minimum viewports:

- 320 x 568
- 360 x 800
- 375 x 812
- 390 x 844
- 412 x 915
- 768 x 1024
- 1024 x 768
- 1280 x 720
- 1366 x 768
- 1440 x 900
- 1920 x 1080

Also test portrait, landscape, browser zoom at 200%, text enlargement, reduced motion, and supported color themes.

For each viewport compare:

```js
({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  bodyScrollWidth: document.body.scrollWidth,
})
```

Unexpected horizontal overflow is a defect. Inspect the specific flex item, grid item, fixed-width control, table, chart, dialog, timestamp, filename, image, or action group producing it and fix the root sizing constraint.

Regression-test the YouTube Clipper job list at 360px. Expected:

- `clientWidth = 360`
- `scrollWidth = 360`
- `bodyScrollWidth = 360`

Review and improve visual hierarchy, spacing rhythm, alignment, typography, status colors, button hierarchy, card density, form flow, empty states, loading skeletons, touch targets, focus treatment, dialog sizing, scanability, and consistency. Explain the user impact of subjective changes and preserve established product patterns.

## Phase 7: Accessibility

Meet WCAG 2.2 AA for all changed and critical flows.

Run automated scanning and manually verify:

- Keyboard-only operation
- Logical tab order
- Visible focus
- Skip link
- Semantic landmarks
- Heading hierarchy
- Accessible names and descriptions
- Form labels and error associations
- Required fields
- Modal focus trap and restoration
- Menus, tabs, accordions, tooltips, dropdowns, and sliders
- Toast, progress, and job-status announcements
- Tables and charts
- Meaningful image alternative text
- Decorative icon hiding
- Text and non-text contrast
- Status not conveyed through color alone
- Touch target sizes
- Zoom and text resizing
- Reduced-motion preferences
- Dynamic content announcements

Add regression tests for accessibility failures when practical. Automated scores alone are not completion.

## Phase 8: Performance

Establish before-and-after measurements for representative pages:

- Homepage
- Features
- Pricing
- Blog index
- A long blog article
- Login
- Signup
- Authenticated dashboard
- Project page
- YouTube Clipper
- Clip job detail

Measure and improve:

- LCP
- INP or the best available interaction proxy
- CLS
- TTFB
- FCP
- Total Blocking Time
- JavaScript, CSS, image, font, and total transfer size
- Request count and waterfalls
- Long tasks
- Third-party scripts
- Cache behavior
- Compression
- Image loading and sizing
- Font loading
- Route transition latency
- Repeated requests
- Excessive polling
- Memory or event-listener leaks

Targets:

- LCP at or below 2.5 seconds
- INP at or below 200 milliseconds
- CLS at or below 0.1
- Mobile Lighthouse Performance at least 90 where realistic for the tested route
- Lighthouse Accessibility at least 90, with critical manual WCAG checks passing
- Lighthouse Best Practices at least 90
- Lighthouse SEO at least 95 for indexable public pages

Do not blindly optimize a score at the expense of correctness, accessibility, security, or product behavior. Distinguish laboratory results from field data.

## Phase 9: Technical SEO and content discovery

Inspect and repair:

- Unique page titles and meta descriptions
- Canonical URLs using `https://vidrial.vercel.app`
- Robots directives
- `robots.txt`
- `sitemap.xml`
- `sitemap-pages.xml`
- `sitemap-blog.xml`
- RSS feed
- Correct status codes
- Redirect chains
- Duplicate URL variants
- Open Graph and social-card metadata
- Favicons and web manifest
- Organization, SoftwareApplication, Article, Breadcrumb, and appropriate visible-content schema
- Author, publication, and modification information
- Internal links and orphan pages
- Heading hierarchy
- Crawlable links
- Blog categories and pagination
- Accidental indexing of authenticated, callback, reset-token, or private routes
- Broken external and internal links

Validate structured data with current official tools where available. Do not add schema for content that is not visible to users.

## Phase 10: Integrations, async updates, and security boundaries

Safely verify and repair observable behavior for:

- Supabase authentication
- Database-backed pages
- Workspace-scoped RLS
- Private storage and signed URLs
- Upload progress and cancellation
- Worker health
- Media acquisition service health
- Transcription
- Rendering
- Webhooks
- Realtime or polling updates
- Email confirmation and recovery
- Google OAuth entry points
- YouTube Data API connector
- Usage and entitlement enforcement
- Billing UI without completing purchases

Confirm:

- Service-role credentials never reach browser responses or bundles.
- Private URLs are not embedded in public HTML or analytics.
- Cross-workspace object access is denied.
- Browser input cannot disable server-derived watermark or plan enforcement.
- Queue handlers are idempotent and duplicate requests do not create duplicate jobs.
- Webhook signatures, replay behavior, retries, and deduplication are enforced.
- Failed jobs do not remain `processing` forever.
- UI status matches persisted backend state.
- Toasts are triggered by authoritative state rather than optimistic assumptions.
- Direct media URLs pass through the repository's SSRF, redirect, DNS/IP, protocol, timeout, and size restrictions before worker processing.

Do not perform destructive exploitation. If a suspected security issue needs invasive validation, stop at a safe proof and document it.

## Console and network quality gate

On representative routes, investigate and fix actionable:

- Uncaught exceptions
- React hydration warnings
- Failed first-party requests
- CORS errors
- CSP violations
- Mixed content
- Duplicate requests
- Infinite polling or retry loops
- Requests after unmount
- Missing assets
- Sensitive response or source-map exposure

Separate harmless browser-extension or automation noise from application defects.

## Automated verification

Run the repository's actual commands and report exact results. At minimum:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run worker:test
npm run test:e2e
```

Also run relevant content, Supabase, and targeted test commands when available, including:

```bash
npm run content:validate
npm run content:links
```

Do not silently update tests merely to accept a regression. When intended behavior changes, explain the product reason in the test or commit.

Do not fabricate passing counts. Preserve full logs or concise machine-readable summaries as evidence.

## Browser compatibility

Verify current supported versions where the environment permits:

- Chrome desktop and Android-equivalent mobile behavior
- Microsoft Edge
- Firefox
- Safari or WebKit
- iOS Safari-equivalent viewport and interaction behavior
- Samsung Internet-equivalent Chromium behavior where feasible

If a real engine is unavailable, mark it `Not tested`; do not treat Chromium emulation as proof of Safari compatibility.

## Git, review, and deployment

1. Keep commits small, coherent, and buildable.
2. Include tests with their corresponding fixes.
3. Push a feature branch without rewriting history.
4. Create a pull request summarizing root causes, changes, risks, tests, screenshots, and research sources.
5. Wait for required GitHub and Vercel checks.
6. Fix failing checks rather than bypassing them.
7. Merge through the repository's normal merge strategy when authorized.
8. Confirm Vercel production is `READY` for the exact merge commit and that the canonical aliases point to it.
9. Confirm worker or other service revisions when changed.
10. Re-run critical browser journeys on `https://vidrial.vercel.app` after deployment.
11. Compare the production commit SHA with the expected merge commit.

A green preview is useful but is not production verification.

## Final production verification

After deployment, repeat at minimum:

- Homepage desktop and 360px mobile
- Signup desktop and 360px mobile
- Login desktop and 360px mobile
- Password recovery boundary
- Authenticated dashboard
- Project creation or a safe equivalent
- Upload boundary
- YouTube Clipper list at 360px with exact width measurements
- A complete permitted YouTube clipping job
- Job refresh and async status recovery
- Clip playback and authorized download
- Settings and integrations
- Representative blog article
- Sitemap, robots, canonical, metadata, and structured-data checks
- Console and failed-network-request scan
- Lighthouse comparison for representative public and authenticated routes

For Turnstile, accept either a successful automatic check or a legitimate interactive challenge. Do not solve or bypass CAPTCHA in automation.

## Required final deliverable

Return one complete Markdown implementation report with this structure:

### 1. Outcome

- Overall production status
- Whether signup and login work
- Whether YouTube clipping works end to end
- Whether mobile responsiveness passes
- Whether critical accessibility, performance, and SEO requirements pass
- Exact production commit and deployment revision

### 2. Implemented changes

Use a table:

| Issue ID | Severity | Root cause | Files changed | Fix | Regression test | Production result |
|---|---|---|---|---|---|---|

### 3. User journeys verified

For every critical journey include steps, result, screenshots, network evidence, and persisted-state evidence.

### 4. UI and responsive results

Include viewport matrix, before/after screenshots, exact overflow measurements, and remaining visual concerns.

### 5. Accessibility results

Include automated results, manual keyboard results, WCAG mappings, and fixes.

### 6. Performance results

Provide before/after metrics per representative page. Clearly separate lab and field data.

### 7. SEO results

Include metadata, canonical, sitemap, robots, structured-data, link, and indexability results.

### 8. Integration results

Use `Pass`, `Fail`, `Partial`, `Blocked`, or `Not tested`. Include evidence and recovery behavior.

### 9. Automated test results

List every command, pass/fail result, test counts, and relevant logs.

### 10. Git and deployment evidence

- Branch
- Commits
- Pull request URL
- Merge commit
- Vercel deployment ID and URL
- Worker/service revision IDs if changed
- Production verification timestamp

### 11. Remaining risks and blockers

List only genuine unresolved items. For each, include impact, evidence, why it could not be safely completed, and the smallest next action.

### 12. Evidence index

List all screenshots, traces, Lighthouse reports, console captures, job URLs or IDs with private information redacted, and tested routes.

### 13. Worklog

Append a dated repository worklog under `docs/superpowers/plans/` describing what was changed, the evidence behind the decisions, verification boundaries, deployment artifacts, and residual risks.

## Final behavior rules

- Do not stop after auditing.
- Do not return only a plan.
- Do not return only code changes without testing them.
- Do not claim a local or preview success is production success.
- Do not mark untested behavior as passing.
- Do not fabricate screenshots, test counts, job results, deployment state, or provider health.
- Do not weaken security to make tests pass.
- Do not expose secrets.
- Continue fixing confirmed in-scope defects until all are resolved or genuinely blocked.
- Lead the final response with the verified production outcome, not a description of your process.

