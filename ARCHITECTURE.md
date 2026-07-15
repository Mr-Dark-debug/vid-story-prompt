# Vidrial Architecture

## Stack

- **Framework**: TanStack Start v1 (React 19, SSR, file-based routing)
- **Build**: Vite 7 via `@lovable.dev/vite-tanstack-config`
- **Runtime target**: Cloudflare Workers (edge) with `nodejs_compat`
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
│ TanStack Start SSR (Cloudflare Worker)       │
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

TanStack Start serves the marketing and authenticated application on Vercel/Lovable-compatible Nitro output. Supabase provides Auth, PostgreSQL, Realtime, private Storage and PGMQ. Cookie-backed server clients verify users; service-role clients exist only in trusted server/worker modules.

Job creation atomically checks workspace, plan, usage and concurrency; records rights; reserves usage; creates a task; and writes an outbox event. PGMQ wakes a portable worker while `job_tasks` remains authoritative for leases, retries, recovery and idempotency. The worker streams immutable artifacts through isolated temp directories and executes FFmpeg with argument arrays.

See `docs/adr/0001-external-video-worker.md` for the worker placement decision.

## Connector platform

The typed registry in `src/domain/connectors` drives source discovery, search, grouping and honest availability. OAuth and provider API calls live under `src/services/connectors`; React only receives serialisable definitions, safe account metadata and remote asset records. `oauth_connections` remains the encrypted token source of truth and `connector_connections` is its token-free security-invoker view.

Remote imports use `connector_imports` plus independently leased `connector_tasks`. The worker obtains provider tokens only from the encrypted server store, streams an officially authorised asset into an isolated directory, bounds transfer size/time, validates MIME and FFprobe output, writes an immutable private object and attaches the resulting `media_asset`. Clip usage is still reserved only when the user confirms a clipping job.
