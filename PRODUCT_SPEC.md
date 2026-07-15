# Vidrial Product Specification

## Vision

Vidrial is a browser-first, AI-assisted video editor that turns authorised
long-form source media into explainable, editable short clips. Every edit
the AI proposes is a reviewable plan — never a black box.

## Target users

- **Creators** repurposing podcasts, streams, and long videos into shorts.
- **Educators** producing course clips from lectures.
- **Product teams** building demo reels from raw captures.
- **Marketers** turning webinars into social cutdowns.

## Core value propositions

1. **Explainable AI edits** — every generated change lists the operations
   (trim, split, insert, ripple-delete) before it is applied.
2. **Rights-first ingestion** — only authorised uploads or owner-controlled
   direct-media URLs; YouTube used for metadata/embed only.
3. **Editable output** — clips remain fully editable manifests, not baked
   renders, until export.
4. **Transparent usage** — quotas, watermarking, and retention are visible
   in-product.

## Feature surface (implemented as mock prototype)

### Marketing site
Home, Features, How it Works, Pricing, Use Cases (Podcasts, Courses,
Product Demos, Short-form, YouTube), Docs (Getting Started, Uploading,
AI Editor, Timeline, Exporting), Security, AI Transparency, Roadmap,
Changelog, Contact, Status, Legal (Terms, Privacy, Cookies, AUP,
Copyright, Imprint), Design System.

### Authenticated app
- Dashboard with recent projects and usage
- 5-step project creation wizard
- Project tabs: Overview, Editor, Media, Transcript, Versions, Exports
- Timeline editor with multi-track, zoom, playhead, undo/redo (50 levels)
- AI panel with prompt → plan → accept/reject per operation
- Interactive transcript with word-level exclusion
- Media library with natural-language search
- Export queue with simulated render states
- Uploads with progress simulation
- Usage meters, billing, templates, help, feedback
- Settings: Profile, Preferences, Notifications, Privacy, Integrations

### YouTube Clipper
Dedicated flow for authorised YouTube sources with rights attestation,
plan-based clip selection, job progress, and per-clip editor.

## Non-goals

- Scraping unauthorised YouTube streams
- Fully automated posting without human review
- Native desktop or mobile apps (browser-first)

## Success metrics

- Time from source to first exported clip < 5 minutes
- ≥ 80% of AI-proposed operations accepted without edit
- Zero rights-violation incidents
- WCAG 2.2 AA conformance across all shipped routes
# Product specification

YouTube Clipper turns one authorised long-form source into multiple complete, editable short clips. It prioritises standalone clarity, story completeness, transparent selection reasoning, durable processing and copyright compliance. It never promises virality.

Free includes 60 monthly source minutes, 30 minutes per job, five suggestions, one active job, 720p, seven-day retention and one lifetime unwatermarked trial export. Creator and Pro limits are defined only in the canonical entitlement module and seeded plan rows.

Source processing supports resumable local uploads and controlled owner media URLs. A YouTube URL supplies official metadata and optional channel-management verification, never unofficial media downloading.

The source step is a three-step wizard with compact quick actions, a searchable grouped connector picker, a responsive mobile drawer, recent sources, a full directory, one focused connector panel and versioned rights confirmation. Available today means the execution path exists; configured beta means official provider credentials are present; coming soon means execution is disabled and waitlist interest may be recorded.

Local video, protected HTTPS URLs, YouTube metadata plus an original attachment, and public podcast RSS are first-party paths. Google Drive, Dropbox and OneDrive have official PKCE/browse/import adapters but remain beta until a deployment configures credentials and completes provider verification. All other catalog entries remain non-executable unless the central registry and backend are changed together.
