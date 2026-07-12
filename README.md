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

```bash
bun install
bun run dev
```

The dev server runs on `http://localhost:8080`. Public env vars
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are optional for the
marketing prototype but required to exercise the authenticated backend.

## Scripts

- `bun run dev` — start the Vite dev server
- `bun run build` — production build
- `bun run typecheck` — strict TypeScript check
- `bun run lint` — ESLint
- `bun test` — Vitest suite
- `bunx playwright test` — end-to-end tests

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