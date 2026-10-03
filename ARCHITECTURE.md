# Vidrial Architecture

## Motion Studio (feature branch, deployment gated)

`src/domain/motion` owns the deterministic HTML contract, linter, staged prompts and category registry. Route components use `src/services/motion` for workspace persistence and durable queue work. Motion projects have immutable source versions and separately queued render records. Browser code never receives provider or service credentials.

The privileged queue controller performs model, database and storage work. Submitted scene code runs only in a separate disposable browser container with no credentials, no outbound network, read-only root and explicit resource/time bounds. An opaque iframe provides the browser preview. Output is an MP4 only after frame and FFprobe checks; unavailable model/worker lanes remain disabled.

Public prompts combine approved database rows with explicitly labelled original authored examples. Real counters belong to database rows. Local demo videos are exposed only by the verified asset manifest. The article pipeline supports an allowlisted `motion-prompt` code block resolved by original catalog slug; it does not enable arbitrary embedded HTML.

Signup carries only an opaque session draft identifier. Private prompt text stays in tab-scoped session storage and expires after 24 hours. Public gallery opt-in, user-granted licensing and moderation remain separate from private generation.

## Clip Studio acquisition reliability

Exact Cut on `feat/clip-studio`: `clip_candidates.origin` distinguishes
`ai_discovery`, `manual_timestamp` and `transcript_selection`. The migration
backfills existing rows as AI discovery. Selected ranges have null metric columns
and a null planning-run reference, not fabricated scores or a fake LLM run. The
worker planner still validates only strictly scored AI output.

`create_clip_job` validates canonical plan limits, source ownership, rights,
concurrency and timestamps in one workspace-serialized transaction. Exact Cut
reserves `ceil(sum(range durations))`, not source runtime. Request fingerprints
make retries idempotent and reject conflicting reuse. Immutable job contracts
prevent browser mutation of the paid ranges. Early cancellation releases unused
reservations, while committed processing is not refunded.

After source validation, worker-only `materialize_exact_cut` verifies the live
task lease and rights, creates unscored candidates/clips/immutable versions once,
commits usage and returns ordinary preview children. There are no transcript,
scene or planner children. External acquisition remains once per job; each
preview may still retrieve the stored source. The existing transformed/watermarked
renderer re-encodes; a stream-copy optimization has not been introduced.

Private `clip_processing_allowances` and a version-insert trigger charge only
extensions beyond a clip's paid duration. Quota failures roll back version and
debit together. `activate_clip_version` checks workspace, retention and exact
clip/version ownership without adding broad browser UPDATE access to clips.
The wizard checks `clip_studio_capabilities`; apply the complete ordered migration
set after deploying the compatible worker, then deploy the web app. Production
database types must be regenerated after migration; live release remains pending.

Source failures are classified at the acquisition boundary and retained in durable
attempt records, task errors and processing events. Known transient failures get
one same-path retry with bounded backoff; restarts consult persisted attempts.
Private, age, region and DRM restrictions stop rather than triggering bypasses.
Unknown errors and HTTP 403 responses do not establish an IP block on their own.
The worker-only `fail_clip_task` RPC owns queue transitions and source-recovery
state without releasing the existing reservation or resurrecting cancelled jobs.
`/status` consumes only sanitized worker health, not provider credentials or URLs.

## Stack

- **Framework**: TanStack Start v1 (React 19, SSR, file-based routing)
- **Build**: Vite 7 via `@lovable.dev/vite-tanstack-config`
- **Runtime target**: Vercel production deploys use Nitro's `vercel` preset: a Node.js 24
  serverless function with response streaming (`.vercel/output/functions/__server.func`).
  When no host is detected (for example a local `npm run build` or the Lovable preview) the
  Lovable Vite config falls back to the `cloudflare-module` preset with `nodejs_compat`.
  Server code must therefore use only Web-standard APIs (`fetch`, `Response`, `ReadableStream`,
  `AbortSignal`, Web Crypto) so it behaves identically on both. Never rely on Node-only streams
  or on a request surviving a client disconnect.
- **Styling**: Tailwind CSS v4 with tokens in `src/styles.css`
- **State**: Zustand (timeline history), TanStack Query (server data)
- **Types**: Strict TypeScript
- **Backend (prod)**: Lovable Cloud / Supabase (PostgreSQL, Auth, Storage)
- **Video worker**: External Docker service (FFmpeg, transcription, planning, rendering)

## Layers

```text
┌──────────────────────────────────────────────┐
│ Browser (React 19, TanStack Router client)   │
│  - Marketing pages, editor UI, mock services │
└──────────────────────────────────────────────┘
               │  server functions (createServerFn)
               ▼
┌──────────────────────────────────────────────┐
│ TanStack Start SSR (Vercel Node function)    │
│  - Session verification, RLS-scoped queries  │
│  - Signed URLs, quota enforcement, wake API  │
└──────────────────────────────────────────────┘
               │  postgres / storage
               ▼
┌──────────────────────────────────────────────┐
│ Supabase (Postgres + Storage + Auth)         │
│  - Source of truth, RLS on every table       │
└──────────────────────────────────────────────┘
               │  leased queue jobs
               ▼
┌──────────────────────────────────────────────┐
│ Video Worker (Docker, out-of-band)           │
│  - FFmpeg/FFprobe, Whisper, planner, render  │
└──────────────────────────────────────────────┘
```

## Directory map

- `src/routes/` — file-based routes (never edit `routeTree.gen.ts`)
- `src/components/` — UI (marketing, app, editor, primitives, youtube-clipper)
- `src/domain/` — pure domain logic (clipping, timeline)
- `src/services/` — client + server services (auth, clipping, storage, youtube, worker)
- `src/lib/` — utilities (supabase clients, error page/capture, error reporting)
- `src/config/` — brand, nav, env schemas
- `src/mock/` — deterministic demo seed data
- `src/styles.css` — Tailwind v4 tokens
- `services/video-worker/` — external Docker worker
- `supabase/` — database migrations & config

## Data flow: AI edit

1. User types prompt in `AiPanel`
2. `src/domain/timeline/planner.ts` produces a `PlanOp[]`
3. UI shows plan; user accepts operations individually
4. Accepted ops applied to `timeline/store.ts` (undo history preserved)
5. Version save persists snapshot via `saveClipVersion` server fn

## Boundaries (enforced)

- Browser never uses service-role Supabase credentials
- Server functions validate all input with Zod
- Route components never call Supabase directly — always via `src/services/*`
- Worker independently derives watermark entitlement; browser cannot bypass
- Direct-media URLs pass DNS/IP/redirect/size checks before FFmpeg

## SSR error handling

`src/server.ts` wraps the TanStack Start server entry:

- Lazy import so module-init throws are catchable
- Response normalizer converts h3-swallowed 500s into branded HTML
- `src/lib/error-capture.ts` records out-of-band errors for correlation
- `src/start.ts` registers `errorMiddleware`
- `__root.tsx` sets `errorComponent` and reports to Lovable

# Architecture

TanStack Start serves the marketing and authenticated application as Nitro output (Vercel in production; see the runtime target above). Supabase provides Auth, PostgreSQL, Realtime, private Storage and PGMQ. Cookie-backed server clients verify users; service-role clients exist only in trusted server/worker modules.

Job creation atomically checks workspace, plan, usage and concurrency; records rights; reserves usage; creates a task; and writes an outbox event. PGMQ wakes a portable worker while `job_tasks` remains authoritative for leases, retries, recovery and idempotency. The worker streams immutable artifacts through isolated temp directories and executes FFmpeg with argument arrays.

See `docs/adr/0001-external-video-worker.md` for the worker placement decision.

## Connector platform

The typed registry in `src/domain/connectors` drives source discovery, search, grouping and honest availability. OAuth and provider API calls live under `src/services/connectors`; React only receives serialisable definitions, safe account metadata and remote asset records. `oauth_connections` remains the encrypted token source of truth and `connector_connections` is its token-free security-invoker view.

Remote imports use `connector_imports` plus independently leased `connector_tasks`. The worker obtains provider tokens only from the encrypted server store, streams an officially authorised asset into an isolated directory, bounds transfer size/time, validates MIME and FFprobe output, writes an immutable private object and attaches the resulting `media_asset`. Clip usage is still reserved only when the user confirms a clipping job.

## Motion production boundary

Motion projects, versions, render manifests, usage and leases live in PostgreSQL
with workspace RLS. `approved_motion_prompts` is a security-invoker view over
`motion_public_catalog`, an approved-only RLS projection maintained by a trigger
in the same moderation/counter transaction. Private submissions and author IDs
remain in the restricted source table.

The motion controller runs on a dedicated Linux Docker host, separately from
source acquisition. Before leasing user jobs it proves OS network denial,
nonroot execution, read-only root, credential absence and a real H.264/AAC
watermarked render, then pins subsequent jobs to that image ID. Host deployment
and capability rollout are documented in `services/video-worker/deploy/README.md`.
Vercel hosts the app; its successful deployment does not establish worker
availability. Database and Vercel flags remain disabled until the persistent
host and any enabled provider lane are verified.

## Bring-your-own-key AI layer

`src/domain/ai` is the pure source of truth: the provider registry, error taxonomy and redaction, fetch-based adapters (`validateKey`, `listModels`, `streamChat`, `completeJson`), the credential envelope, resolution order and chat context building. The video worker cannot import the web source tree (separate Docker context), so `scripts/sync-worker-ai.mjs` generates `services/video-worker/src/vendor/ai`; a unit test fails if the copy drifts (`npm run ai:sync`).

Credentials live in `ai_provider_credentials`. Only trusted server/worker code (service role) reads `key_encrypted`; browsers read `ai_provider_connections`. Every outbound call sends the key only in a header, never follows redirects, uses fixed registry base URLs, and redacts the key from every error path.

Two execution lanes share the adapters:

1. **Interactive chat** (`POST /api/ai/chat`). Persists the user message, streams the reply, checkpoints partial text, and always settles the assistant message (`complete`, `cancelled`, `interrupted`, `failed`). It never relies on the request surviving: the stream's `finally`, a heartbeat and a stale sweep settle abandoned replies. A database trigger mirrors the allowed status transitions.
2. **Durable queue** (`ai_runs`). Clip planning keeps riding its existing `job_tasks` task and records an `ai_runs` row for provenance. Standalone work (social copy, regenerate-many) is leased from `ai_runs` itself because `job_tasks` requires a clip job, as connector imports already use `connector_tasks`. `claim_ai_run` enforces a per-credential concurrency cap, reclaims expired leases and dead-letters exhausted ones.

Resolution order for every feature is explicit selection, saved default, platform model, deterministic selection. Unusable user choices are recorded as skipped with a reason, and `planning_runs` stores `credential_source`, `credential_id` and `fallback_reason`. Bring-your-own-key removes model cost, not transcription, rendering, storage or source-minute quotas.
