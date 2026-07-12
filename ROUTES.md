# Vidrial Routes

File-based routing via TanStack Router. Files live in `src/routes/`.
Dots in filenames map to URL slashes; `$param` is dynamic; underscore
prefixes are layout/pathless routes.

## Public marketing

| Path | File | Purpose |
| --- | --- | --- |
| `/` | `index.tsx` | Home with interactive hero |
| `/features` | `features.tsx` | Feature grid |
| `/how-it-works` | `how-it-works.tsx` | Three-step explainer |
| `/pricing` | `pricing.tsx` | Plans + comparison table |
| `/use-cases` | `use-cases.index.tsx` | Vertical hub |
| `/use-cases/podcasts` | `use-cases.podcasts.tsx` | Podcast repurposing |
| `/use-cases/courses` | `use-cases.courses.tsx` | Course clips |
| `/use-cases/product-demos` | `use-cases.product-demos.tsx` | Demo reels |
| `/use-cases/short-form` | `use-cases.short-form.tsx` | Social shorts |
| `/use-cases/youtube` | `use-cases.youtube.tsx` | YouTube clipper landing |
| `/youtube-clipper` | `youtube-clipper.tsx` | Public clipper page |

## Docs

| Path | File |
| --- | --- |
| `/docs` | `docs.tsx` |
| `/docs/getting-started` | `docs.getting-started.tsx` |
| `/docs/uploading-media` | `docs.uploading-media.tsx` |
| `/docs/ai-editor` | `docs.ai-editor.tsx` |
| `/docs/timeline` | `docs.timeline.tsx` |
| `/docs/exporting` | `docs.exporting.tsx` |

## Trust & legal

`/security`, `/ai-transparency`, `/roadmap`, `/changelog`, `/contact`,
`/status`, `/terms`, `/privacy`, `/cookies`, `/acceptable-use`,
`/copyright`, `/imprint`.

## Auth

`/login`, `/signup`, `/forgot-password`, `/reset-password`,
`/verify-email`, `/auth/callback`, `/auth/youtube/callback`.

## Design

`/design-system` — live tokens, type scale, primitives.

## Authenticated app (`_authenticated` layout gate → `/login` if not signed in)

| Path | File |
| --- | --- |
| `/app` | `_authenticated.app.index.tsx` |
| `/app/projects` | `_authenticated.app.projects.index.tsx` |
| `/app/projects/new` | `_authenticated.app.projects.new.tsx` |
| `/app/projects/$projectId` | `_authenticated.app.projects.$projectId.index.tsx` |
| `/app/projects/$projectId/editor` | `.editor.tsx` |
| `/app/projects/$projectId/media` | `.media.tsx` |
| `/app/projects/$projectId/transcript` | `.transcript.tsx` |
| `/app/projects/$projectId/versions` | `.versions.tsx` |
| `/app/projects/$projectId/exports` | `.exports.tsx` |
| `/app/templates` | `_authenticated.app.templates.tsx` |
| `/app/uploads` | `_authenticated.app.uploads.tsx` |
| `/app/usage` | `_authenticated.app.usage.tsx` |
| `/app/billing` | `_authenticated.app.billing.tsx` |
| `/app/help` | `_authenticated.app.help.tsx` |
| `/app/feedback` | `_authenticated.app.feedback.tsx` |
| `/app/settings/*` | `_authenticated.app.settings.*.tsx` |
| `/app/youtube-clipper` | `_authenticated.app.youtube-clipper.index.tsx` |
| `/app/youtube-clipper/new` | `.new.tsx` |
| `/app/youtube-clipper/jobs/$jobId` | `.jobs.$jobId.tsx` |
| `/app/youtube-clipper/clips/$clipId/edit` | `.clips.$clipId.edit.tsx` |

## Route conventions

- Every shareable route defines its own `head()` with unique `title`,
  `description`, `og:title`, `og:description`.
- `og:image` only at leaf routes, never on `__root.tsx`.
- Never edit `src/routeTree.gen.ts` — it is generated.
# Route map

- `/youtube-clipper` — public SEO page and official metadata preview.
- `/app/youtube-clipper` — authenticated job list.
- `/app/youtube-clipper/new` — four-step source, rights, settings and review wizard.
- `/app/youtube-clipper/jobs/:jobId` — durable realtime progress, events and partial results.
- `/app/youtube-clipper/clips/:clipId/edit` — persisted clip-version editor.
- `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password` — Supabase Auth flows with redirect preservation.

File routes follow `src/routes/README.md`. `src/routeTree.gen.ts` is generated only.
