# YouTube Clipper system design

## Scope

YouTube Clipper extends the existing Vidrial TanStack Start application. It preserves the marketing site, authenticated shell, editor prototype, design tokens, route conventions, and reusable components. The first production version accepts authorised local uploads, owner-controlled HTTPS media URLs, and YouTube URLs for official metadata and ownership verification. Where original media is required, use an authorised attachment, an owner-controlled direct-media URL, or a server-side authorised provider download performed under explicit rights attestation and worker-side safeguards.

## Architecture

The TanStack Start application owns user-facing routes, cookie-backed Supabase authentication, metadata requests, job creation, usage enforcement, signed URL issuance, and realtime progress. PostgreSQL/Supabase is the source of truth for workspaces, plans, usage, assets, jobs, tasks, events, transcripts, candidates, versions, renders, exports, and provider records.

An external Node.js/TypeScript container worker owns media validation and processing. It consumes Postgres-backed queue tasks with leases and heartbeats, uses argument-array FFmpeg/FFprobe execution in isolated temporary directories, and writes immutable artifacts to private Supabase Storage. Provider integrations sit behind typed interfaces: Groq Whisper is the primary transcription provider, OpenAI is the transcription fallback, and OpenRouter is the primary clip-planning gateway.

Database mutations that require downstream work create an outbox event in the same transaction. Dispatching converts outbox events into queue messages. Job and task handlers are idempotent, cancellation-aware, retry-safe, time-bounded, and observable. Partial preview success produces a `partially_ready` job instead of discarding successful clips.

## Application boundaries

- Route components render state and delegate all business logic to services.
- Supabase access remains behind repository/service modules.
- Server-owned entitlement definitions are canonical and are mirrored by seeded plan rows.
- The existing Zustand timeline remains the interactive UI store; immutable database clip versions and edit manifests become authoritative.
- Final renders use the same edit-manifest schema displayed in the editor.
- Browser input can never disable a required watermark or increase an entitlement.

## Data and security

All user-owned database tables use RLS based on workspace ownership or membership. Storage buckets are private and object keys begin with workspace and user identifiers. Browser clients use the anon key; service-role credentials exist only in trusted server and worker environments.

Large uploads use resumable TUS transfers. Direct media URLs pass an HTTPS-only controlled downloader that validates DNS results before the initial request and every redirect, rejects private and special-use addresses for IPv4 and IPv6, enforces redirect/size/time limits, streams to an isolated file, and validates the result before FFmpeg sees a local path.

Rights acceptance is versioned and stored transactionally with job creation. Request metadata is privacy-safe; a plain IP address is not retained for this feature. YouTube URLs are parsed strictly and used only with official APIs and embeds. Connected Google accounts prove channel management but do not substitute for source media.

## Processing flow

Job submission authenticates the user, verifies workspace access, evaluates plan and concurrency limits, reserves source seconds, creates the job and attestation, creates the first task, and emits an outbox event atomically.

Processing follows a bounded DAG:

1. Validate or securely download the source.
2. Create a proxy, extract audio, and detect scenes where possible in parallel.
3. Split audio, transcribe chunks with bounded fan-out, and merge deterministically.
4. Generate candidate windows, score them in parallel, validate structured AI output, deduplicate, and select a diverse set.
5. Render previews independently and expose successful clips immediately.
6. Persist editor versions and render final individual or ZIP exports from immutable manifests.
7. Apply retention and immediate-deletion workflows asynchronously.

Usage is reserved at submission, committed after validation and meaningful transcription begins, and released on qualifying early failures through append-only idempotent ledger entries.

## User experience

The public `/youtube-clipper` page reuses the current marketing layout and tokens, provides official metadata preview, and contains a deterministic interactive demonstration. Authentication is required only when a user starts a processing job, and redirect state returns them to the clipping flow.

Authenticated routes provide a job list, four-step source wizard, durable progress view, partial-results gallery, persisted clip editor, and exports. Every recoverable failure names a concrete recovery action. Progress uses known units such as uploaded bytes, transcript chunks, and rendered previews; it does not invent percentages.

## Failure handling and observability

Tasks classify retryable provider, network, storage, and lease failures separately from invalid media, rights, limits, cancellation, and exhausted schema-repair failures. Exponential backoff includes jitter. Expired leases can be recovered after worker restarts. Structured logs contain correlation, job, task, attempt, stage, provider, duration, outcome, and redacted workspace/user context. Health and readiness endpoints verify configuration, FFmpeg, FFprobe, Supabase, and queue access.

## Testing and verification

Vitest covers domain rules, parsers, schemas, usage, state transitions, retry logic, transcript merging, candidate selection, watermark rules, filenames, SSRF controls, and manifest hashing. Testing Library covers critical components. Supabase-local integration tests prove authentication, transactions, RLS isolation, queue idempotency, usage accounting, signed URLs, cleanup, and server-side watermark enforcement. Worker integration tests generate a tiny licensed fixture and inspect outputs with FFprobe. Playwright covers the public-to-authenticated flow, job monitoring, clip editing, and export requests.

Production completion requires type checking, linting, unit/component/integration tests, worker tests, browser flows, and production builds to pass. Provider-dependent success is reported only when real credentials and services are configured and verified.

## Delivery order

Work proceeds through foundations, authentication/persistence, public feature/navigation, ingestion, queue/worker, transcription/planning, previews/results, editor/exports, and cleanup/hardening. Each phase keeps the Lovable-connected branch buildable and does not rewrite published history.
