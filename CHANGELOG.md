# Changelog

## 2026-07-15 — multi-source connectors

- Replaced the duplicated source tiles with one grouped searchable picker, provider marks, recent sources, a responsive picker/directory and focused connector panels.
- Added the central connector, publishing and feature registries plus reusable coming-soon waitlist behavior.
- Added connector definitions, token-free connection view, imports, source attachments, OAuth state, audit, waitlist, automation deduplication and leased import-task migrations with workspace RLS.
- Added official PKCE and browse adapters for Google Drive, Dropbox and OneDrive, plus bounded RSS/Atom and Apple Podcasts feed resolution.
- Added worker-side authorised provider streaming, progress, cancellation, retries, checksum/FFprobe validation and immutable private storage.
- Added rights-attested YouTube acquisition through a pinned, checksum-verified yt-dlp worker path so eligible URLs no longer require a browser upload.
- Added integration settings and automation routes while keeping unverified providers visibly non-executable.

All notable changes to Vidrial are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Motion Studio (2026-10-03, deployment gated)

- Added original motion prompt library, collection/detail resolver, generator gallery and private signup draft handoff.
- Added twenty original briefs, two per canonical category, with truthful demo provenance and zero-initialized counters; verified assets appear through a manifest.
- Added motion guide through the existing validated article pipeline, allowlisted prompt embeds, documentation, trust copy and public discovery links.
- Public previews respect reduced motion and data-saving preferences. Gallery metrics use approved database rows rather than invented engagement.
- Generation and export availability depend on the deployed schema, allowed provider models and isolated worker. Local implementation does not establish production verification.
### Bring-your-own-key AI layer (2026-10-03, branch `feat/byok-ai`, live-provider verification pending)

- Added a single provider registry (`src/domain/ai/providers.ts`) with fetch-only adapters for
  Anthropic, OpenAI, Google Gemini and OpenRouter (available) and Groq, DeepSeek, Mistral, xAI and
  Together AI (beta, not yet exercised with live keys). A user-supplied base URL is deliberately not
  offered until the worker's SSRF controls are reused for it.
- Added encrypted credential storage (AES-256-GCM, HKDF per key version, ciphertext bound to
  workspace/user/provider, rotation via `AI_CREDENTIAL_ENCRYPTION_KEY_VERSION` and
  `AI_CREDENTIAL_ENCRYPTION_KEYS_PREVIOUS`), a token-free connection view, a model cache and
  per-user validation rate limiting. Browser roles cannot select ciphertext.
- Added `/app/settings/ai-providers`, a searchable model picker with maker logos, and
  `/app/chat` with persistent history, SSE streaming, Stop, Regenerate, edit-and-resend and
  clip-job context attachment. Replies checkpoint while streaming and are settled as complete,
  cancelled, interrupted or failed.
- Clip planning, social copy and the AI editor now resolve explicit selection, then the user's
  default, then the platform model, then the deterministic selection, and record which was used.
  Rejected keys are flagged and never retried; rate limits and 5xx errors retry with Retry-After.
- Added a durable `ai_runs` lease queue (claim, heartbeat, cancel, retry classification, per-key
  concurrency cap) with a background social-copy handler, plus Realtime status in the results gallery.
- Fixed first: `bun.lock` now resolves from the public registry and the stale `package-lock.json` was
  removed; the root `errorComponent` typecheck error; unit tests run on a clean checkout; worker
  tests run under Vitest (`bun test` is refused); root Vitest no longer collects worker tests.
- Documented the real deployment target (Vercel Nitro Node function, Worker preset as fallback).
- Not changed: Exact Cut and the full authenticated source-to-export flow remain release-pending.

### Clip Studio Exact Cut wiring (2026-09-07, release pending)

- Wired timestamp mode into the existing source wizard with a database capability
  gate, live selected-duration quota, stable retry keys and canonical clip limits.
- Added transactional range-only reservation, fingerprinted idempotency, source
  ownership checks, immutable paid contracts and early-cancellation release.
- Added leased, idempotent manual-candidate materialization directly into the
  existing preview/editor/export pipeline without transcription or AI planning.
- Added server-enforced edit-duration allowances, incremental extension debits,
  quota rejection and clear pre-save copy. Restoring/shortening does not charge twice.
- Fixed version activation through a scoped RPC: generic browser updates to clips
  had no matching RLS policy and could silently leave the active version unchanged.
- Added isolated PostgreSQL accounting/RLS contracts, 360px/desktop wizard tests
  with explicit mocked-provider boundaries, and a real five-clip FFmpeg decode test.
- Applied the five guarded Exact Cut migrations and rebuilt/restarted the
  compatible home worker; production schema/worker checks passed. The matching
  Vercel preview is green, but authenticated preview verification awaits owner MFA.
- Tightened the legacy queue dispatch RPC to worker-only execution with explicit
  anonymous/browser denial and service-role regression coverage.
- Refreshed the live table type snapshot, including selected candidate origins,
  nullable scores, idempotency fields and edit allowances.
- Pending: authenticated acquisition-to-export E2E, web
  production release, and Clip Studio Phases 2–5. No full production-flow success
  or stream-copy optimization is claimed by these checks.

### Clip Studio reliability (2026-09-06)

- Added the Exact Cut foundation (not enabled yet): range parser/editor tests,
  null-scored manual/transcript candidate variants and origin/backfill migration.
  Results distinguish selected ranges from AI recommendations instead of rendering
  missing scores as zero. Submission, metering and worker wiring were added in
  the subsequent unreleased slice above.

- Preserve distinct source-acquisition reasons through Python, worker attempts,
  database events and customer recovery copy. An unknown error or plain HTTP 403
  no longer asserts a confirmed IP block.
- Retry known transient failures once on the same configured acquisition path,
  with bounded, cancellation-aware backoff and restart-persistent attempt history.
- Show partial render completion and source-waiting states accurately; announce
  actual preview counts without fabricated percentages.
- Replace the static `/status` demonstration with the existing sanitized worker
  source-health check. An unreachable check is unknown, not a confirmed block.
- Add isolated PostgreSQL failure-RPC contract tests and mobile/desktop status
  regressions. Production migration and release verification remain pending.

### Added

- Complete design system documentation (`DESIGN_SYSTEM.md`) with tokens,
  typography, and primitive index.
- Product specification (`PRODUCT_SPEC.md`) covering vision, users,
  features, and non-goals.
- Full route map (`ROUTES.md`) for marketing, docs, auth, and app.
- Architecture overview (`ARCHITECTURE.md`) with stack, layers, and
  data flow.
- Privacy model (`PRIVACY_MODEL.md`) with retention schedule and third
  parties.
- Project `README.md`.

### Fixed

- SSR 500 on `/` when Supabase env vars are absent — public env schema
  now treats Supabase credentials as optional so the marketing prototype
  renders without a configured backend.

## [0.3.0] — Editor prototype

### Added

- Timeline store with 50-level undo/redo, multi-track view, zoom, playhead.
- AI panel with prompt → plan → per-operation accept/reject.
- Interactive transcript with word-level exclusion.
- Media library with natural-language search simulation.
- Export queue with simulated render states.

## [0.2.0] — App shell

### Added

- Mock auth with `_authenticated` gate.
- Dashboard, project list, 5-step creation wizard.
- Tabbed project layout (Overview, Editor, Media, Transcript, Versions,
  Exports).
- Uploads, usage meters, billing, templates, help, feedback, settings.

## [0.1.0] — Foundations & marketing

### Added

- Brand config, warm editorial design tokens (OKLCH), typography.
- Shared primitives (`Logo`, `Section`, `StatusDot`, `TimelineRibbon`,
  `EmptyState`, `UsageMeter`).
- Marketing site: home, features, how-it-works, pricing, use cases, docs,
  trust & legal pages.
- `/design-system` reference route.

# Changelog

## 2026-07-11

- Added YouTube Clipper public and authenticated routes.
- Replaced simulated authentication with cookie-backed Supabase Auth.
- Added workspace schema, RLS, private buckets, usage ledger, rights records, queue/outbox and render/export persistence.
- Added resumable TUS upload, official YouTube metadata parsing, controlled direct-media download and a Docker FFmpeg worker.
- Added transcription/planning adapters, realtime progress, persisted clip versions, captions, server watermarking, retention and tests.
