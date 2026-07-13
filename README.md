# Vidrial

A browser-first, AI-assisted video editor that turns authorised long-form
source media into explainable, editable short clips. Every AI edit is a
reviewable plan — never a black box.

## Highlights

- **Marketing site** — home, features, how-it-works, pricing, use cases,
  docs, trust & legal pages
- **Authenticated app** — dashboard, project wizard, tabbed project layout
  (Overview / Editor / Media / Transcript / Versions / Exports)
- **Editor prototype** — multi-track timeline with zoom, playhead, and
  50-level undo/redo; AI panel producing accept/reject plan operations;
  interactive word-level transcript
- **YouTube Clipper** — rights-first flow for authorised sources
- **Design system** — live token reference at `/design-system`

## Tech stack

TanStack Start v1 · React 19 · Vite 7 · Tailwind v4 · Zustand ·
TanStack Query · Strict TypeScript · Cloudflare Workers (edge) ·
Supabase (Auth / Postgres / Storage) · External Docker video worker
(FFmpeg, Whisper, planner).

## Getting started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (primary package manager and runtime)
- Node.js ≥ 20 (used by some tooling)
- [Docker Desktop](https://www.docker.com/) — required for the local
  Supabase stack (`supabase start`) and the video worker container
- [Supabase CLI](https://supabase.com/docs/guides/cli) — for local DB,
  migrations, and type generation
- FFmpeg / FFprobe — only needed if you run the video worker locally
  outside Docker

### 1. Install dependencies

```bash
bun install
bun install --cwd services/video-worker   # optional: only for the worker
```

### 2. Configure environment variables

Copy the example file and fill in values as needed:

```bash
cp .env.example .env
```

The marketing prototype runs with an empty `.env`. To exercise the
authenticated app and backend features, set at minimum:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Supabase publishable key |
| `SUPABASE_URL` | Server | Supabase URL used by server functions |
| `SUPABASE_ANON_KEY` | Server | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Privileged admin operations |
| `PUBLIC_APP_URL` | Server | Base URL for OAuth redirects |

Additional groups (only needed for the matching feature):

- **YouTube / Google OAuth** — `YOUTUBE_API_KEY`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY` (≥ 32 chars)
- **Abuse protection** — `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- **AI providers** — `GROQ_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`
  and matching model names
- **Video worker** — `VIDEO_WORKER_URL`, `WORKER_WAKE_SECRET`,
  concurrency, timeout and FFmpeg settings (see `.env.example`)

Never prefix server-only secrets with `VITE_` and never commit `.env`.
See [`docs/AUTHENTICATION.md`](./docs/AUTHENTICATION.md) for the full
Google/Supabase OAuth setup.

### 3. Start local Supabase (optional)

```bash
bun run supabase:start   # boots the local Supabase stack via Docker
bun run supabase:reset   # applies migrations + seed data
bun run supabase:types   # regenerates src/lib/supabase/database.types.ts
```

### 4. Run the app

```bash
bun run dev
```

The dev server listens on [http://localhost:8080](http://localhost:8080)
with HMR. To run the external video worker alongside it:

```bash
bun run worker:dev
```

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the Vite dev server on port 8080 |
| `bun run build` | Production build (Cloudflare Workers target) |
| `bun run build:dev` | Build with development mode flags |
| `bun run preview` | Preview the production build locally |
| `bun run typecheck` | Strict TypeScript check (`tsc --noEmit`) |
| `bun run lint` | ESLint across the repo |
| `bun run format` | Prettier write |
| `bun run test` | Run the Vitest suite once |
| `bun run test:watch` | Vitest in watch mode |
| `bun run test:coverage` | Vitest with V8 coverage |
| `bun run test:e2e` | Playwright end-to-end tests |
| `bun run supabase:start` / `:stop` / `:reset` | Manage the local Supabase stack |
| `bun run supabase:types` | Regenerate Supabase DB types |
| `bun run worker:dev` | Run the external video worker locally |
| `bun run worker:test` | Run the video worker test suite |

Before opening a PR, run:

```bash
bun run typecheck && bun run lint && bun run test && bun run build
```

## Repository map

- `src/routes/` — file-based TanStack routes (never edit `routeTree.gen.ts`)
- `src/components/` — UI (marketing, app, editor, primitives, youtube-clipper)
- `src/domain/` — pure domain logic (clipping, timeline)
- `src/services/` — client + server services
- `src/lib/` — utilities (Supabase clients, error handling)
- `src/config/` — brand, nav, env schemas
- `src/styles.css` — Tailwind v4 tokens
- `services/video-worker/` — external Docker worker
- `supabase/` — database migrations & config

## Documentation

| File | Purpose |
| --- | --- |
| [AGENTS.md](./AGENTS.md) | Engineering rules for contributors and agents |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Stack, layers, data flow |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Tokens, typography, primitives |
| [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) | Vision, users, feature surface |
| [ROUTES.md](./ROUTES.md) | Complete route map |
| [PRIVACY_MODEL.md](./PRIVACY_MODEL.md) | Data categories, retention, third parties |
| [CHANGELOG.md](./CHANGELOG.md) | Release notes |
| `docs/` | Runbook, deployment, auth, video worker, YouTube clipper |

## License

Proprietary. All rights reserved.