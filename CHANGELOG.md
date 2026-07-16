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
