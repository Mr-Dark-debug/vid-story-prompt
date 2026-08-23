# Vidrial Production SEO Registration and Growth Worklog

> **For agentic workers:** Continue this file append-only. Preserve verified facts, label account/security boundaries honestly, and never infer provider registration or production deployment from local code alone.

**Goal:** Establish and verify a production-grade organic-search operating system for Vidrial across technical SEO, content discovery, analytics, webmaster platforms, search submissions, monitoring, and repeatable audits.

**Architecture:** Preserve the existing typed blog and canonical-origin foundations, then build an authoritative production URL inventory that drives audits and submission evidence. Keep search metadata centralized, provider verification configurable, analytics privacy-conscious, IndexNow incremental, and every external registration tied to visible authenticated-provider evidence.

**Tech Stack:** TanStack Start/Router, React 19, TypeScript, Markdown/Zod content, Vitest, Playwright, Vercel, Supabase, IndexNow, Google Search Console/GA4, Bing Webmaster Tools, and free legitimate SEO-provider tooling.

## Global constraints

- Canonical production host is `https://vidrial.vercel.app/` unless a live owner-controlled custom domain is independently proven.
- Do not purchase services, domains, plans, phone numbers, identities, or paid API access without explicit owner approval.
- Do not bypass MFA, CAPTCHA, Turnstile, phone, identity, or regional-account requirements.
- Do not expose secrets, private URLs, filenames, transcripts, tokens, uploaded media, or personal form fields to analytics or logs.
- Preserve server-side Siteverify and managed Turnstile behavior.
- Preserve unrelated worktree changes and Lovable-published history; never force-push, rebase, amend, or squash published commits.
- Do not fabricate provider registration, indexing, rankings, traffic, backlinks, audit health, deployment, or test results.

## Execution checklist

- [ ] Establish repository, GitHub, Vercel, deployment, production, and existing SEO truth.
- [ ] Generate the authoritative machine-readable production URL inventory.
- [ ] Audit crawlability, indexability, metadata, canonicals, structured data, internal links, redirects, 404s, mobile rendering, accessibility, and performance.
- [ ] Complete competitor and keyword-intent research with current primary/search evidence.
- [ ] Implement and test confirmed technical/content/analytics/IndexNow fixes.
- [ ] Complete legitimate provider registrations and sitemap submissions where authenticated access and security checks permit.
- [ ] Deploy the verified revision and repeat production checks.
- [ ] Publish the final service matrix, evidence index, operations guide, and implementation report.

## Evidence log

### 2026-08-24 — initial production truth

- Repository: `Mr-Dark-debug/vid-story-prompt`; local branch `main` at `6e94e4f`, matching `origin/main` at inspection time.
- GitHub CLI is authenticated as `Mr-Dark-debug`; no open pull requests were returned by `gh pr list --state open`.
- Existing unrelated worktree changes were present before this task: modified `docs/prompts/logs/2026-08-14-clipper-hardening.md`, untracked `docs/agent-prompts/`, and untracked `docs/superpowers/plans/2026-08-14-home-worker-e2e-publishing-prep.md`. They are out of scope and must be preserved.
- Local Vercel link identifies project `vidrial`, project id `prj_ULICxYB5ofpMzS26gBYtS1JnyiJg`, org id `team_fHkJ8BWpDMUbmbBrk6lppZF1`, Node `24.x`. A standalone `vercel` executable was not installed at inspection time.
- `https://vidrial.vercel.app/` returned HTTP 200 and production HTML.
- `https://vidrial.vercel.app/robots.txt` returned HTTP 200, allows public crawling, disallows `/app/`, `/api/`, and `/auth/`, and references the root sitemap.
- `https://vidrial.vercel.app/sitemap.xml` returned HTTP 200 and references `sitemap-pages.xml` and `sitemap-blog.xml`.
- Both child sitemaps returned HTTP 200 with XML content.
- `https://vidrial.vercel.app/rss.xml` returned HTTP 200 with RSS content and canonical Vidrial article URLs.
- The existing IndexNow proof file is `public/632573bd4c22eb026288a736579ebeba9bdb3b8480acee68dc7b47f0133eb2f2.txt`; production verification remains to be recorded below.
- Historic implementation evidence says Search Console/Bing ownership and deployment were previously unverified; this worklog does not treat them as configured until current provider evidence is captured.

## Decision log

- The user-supplied execution brief is the approved design and success specification. Work proceeds without a redundant approval pause.
- Existing working SEO systems will be extended or fixed only when current audit evidence identifies a gap.
- Google Tag Manager will only be added if it provides a maintainability benefit over the existing/direct analytics architecture; duplicate instrumentation is prohibited.

### 2026-08-24 — implementation and provider evidence

- Commit `c13d364` was pushed to `main` and deployed by Vercel as `dpl_A4inDegaThxKJiTgjyhuaFx7cQrE`; Vercel reported `READY` and assigned `vidrial.vercel.app` plus its existing aliases.
- Rendered production HTML contains the Google verification meta token. Google Search Console opened the URL-prefix property as verified and displayed normal reports with “Processing data, please check again in a day or so.”
- The Search Console sitemap report contained zero submitted sitemaps at inspection time. `robots.txt` already advertises the root sitemap, but console submission is still pending.
- The initial production crawl recorded 78 inventory items, 45 sitemap URLs, 52 indexable pages, 0 errors/non-200/orphans/invalid JSON-LD, 5 non-self canonicals caused by the docs layout, 21 duplicate titles, and 27 duplicate descriptions. The duplicate counts were primarily authenticated/noindex redirects.
- After deployment, `npm run seo:audit` recorded 78 inventory items, 51 sitemap URLs, 51 indexable pages, 0 errors/non-200/multiple/non-self canonicals/duplicate indexable titles/duplicate indexable descriptions/orphans/invalid JSON-LD. One internal design-system route lacked a canonical and was subsequently changed to `noindex,nofollow` with a self-canonical.
- `content:validate` passed 60 articles plus 60 paired research notes and 60 independent reviews. `content:audit` passed with 0 blockers/revisions. `content:links` checked 219 links with 0 failures.
- Search-result baseline queries for `site:vidrial.vercel.app`, the Vidrial name, and the blog returned no results on 2026-08-24. This is a baseline, not evidence of future indexing or ranking.
- Google Analytics exposed an existing property labelled `literna-vscode` with measurement ID `G-GNXL7J1SBN` and no received data. The direct GA4 runtime was implemented without GTM because the existing provider abstraction is sufficient.
- Real-browser consent verification proved: no Google request before opt-in; the Google tag loaded with HTTP 200 after opt-in; advertising/analytics consent state was queued correctly; `/cookies` reopened settings; revocation stored `analytics:false`, set `ga-disable-G-GNXL7J1SBN=true`, and queued denied storage.
- The first consent test exposed a CSP block for `googletagmanager.com`; the CSP was corrected narrowly and the tag then loaded successfully. Turnstile, framing, object, form-action, and private-origin controls remained intact.
- Production Lighthouse baseline: desktop 95/90/96/100 and mobile 74/90/96/100 for Performance/Accessibility/Best Practices/SEO. Mobile LCP was 4.5 s, CLS 0, and TBT 10 ms. Source fixes removed external Google Fonts and corrected the reported unnamed preview button, low-contrast labels/footer text, and logo label mismatch. Post-deploy scores remain to be captured.
- Bing Webmaster Tools authentication succeeded through the owner's Google identity. The console currently lists `moltjobs.lovable.app`; Vidrial import/addition has not been completed or claimed.
- IndexNow proof and the protected production endpoint are live, but the local environment has no `INDEXNOW_TRIGGER_SECRET`; no authenticated production reconciliation was sent.
- Current official-provider research was recorded in `docs/seo/2026-08-24-production-seo-growth-report.md`. Yahoo is Bing-powered for algorithmic results; DuckDuckGo largely sources traditional links/images from Bing while maintaining additional crawlers/indexes; Brave has crawl/refetch guidance but no general add-site console; Yandex and Naver have separate ownership/sitemap flows.

### Current execution status

- Completed: repository/production truth, authoritative inventory, technical crawl, metadata/canonical/structured-data/sitemap fixes, consent-gated GA4 implementation, competitor/intent baseline, provider architecture research, local build/type/content/targeted tests, Google ownership, operations/report documentation.
- Pending after this source revision: full lint/test/worker/build gate, commit/push/deploy, post-deploy crawl/Lighthouse/consent verification, Search Console sitemap submission, Bing import/site submission, and authenticated IndexNow execution.
- Security/account boundary: third-party account mutations and submissions must be confirmed at their action boundary; IndexNow additionally requires the missing server-only trigger secret.

### 2026-08-24 — final local quality gate

- `npm run typecheck` passed with no diagnostics.
- `npm run lint` passed with 0 errors and 7 pre-existing Fast Refresh warnings.
- `npm test` passed 72 files plus 1 skipped file: 311 tests passed and 6 skipped.
- `npm run worker:test` passed 19 files and 100 tests.
- `npm run build` passed after validating all 60 published articles, all 60 paired research notes, and all 60 independent reviews.
- `git diff --check` reported no whitespace errors. The source revision is ready to integrate with the remote Lovable-connected branch and deploy.

### 2026-08-24 — upstream integration gate

- Four upstream Lovable-connected commits were integrated with a normal merge; no published history was rewritten and the merge completed without conflicts.
- The integrated revision again passed `npm run typecheck` and `npm run build`.
- The integrated app suite passed 73 files plus 1 skipped file: 314 tests passed and 6 skipped.
- The integrated worker suite passed 20 files and 103 tests.

### 2026-08-24 — final production verification

- `main` was pushed without force to commit `c5a1c6817550c758c6f7972ab1da75f741bfdbe9` after safely integrating concurrent Lovable-connected upstream work.
- Vercel deployment `dpl_HntPGxes49Ds2TMtEkGpjKxd6TQo` reached `READY` and is assigned to `vidrial.vercel.app`.
- The production alias returned HTTP 200, the PNG social card returned HTTP 200 as `image/png` with 21,718 bytes, rendered HTML referenced the PNG card and Google verification token, and CSP contained only the required Google tag/analytics additions alongside the existing protections.
- The final production crawl recorded 78 inventory items, 51 sitemap URLs, 51 indexable pages, and zero errors across non-200 responses, missing/multiple/non-self canonicals, missing descriptions/H1s, duplicate indexable titles/descriptions, orphans, and invalid structured data.
- Post-deploy Lighthouse scored desktop 97/100/96/100 and mobile 83/100/96/100 for Performance/Accessibility/Best Practices/SEO. Desktop LCP was 0.8 s with 0 ms TBT; mobile LCP was 3.7 s with CLS 0.01 and 20 ms TBT.
- Remaining external operations are limited to provider-console submission/import actions and authenticated IndexNow execution; no such external success is inferred from the clean deployment.
- A fresh production browser context confirmed zero Google requests and an empty data layer before consent. Clicking `Accept optional` loaded only `https://www.googletagmanager.com/gtag/js?id=G-GNXL7J1SBN`, stored analytics consent, denied all advertising consent fields, disabled Google signals, and queued the route page view. Reopening settings on `/cookies` and choosing `Only necessary` stored analytics denial, queued `analytics_storage: denied`, and set `ga-disable-G-GNXL7J1SBN` to `true`.
