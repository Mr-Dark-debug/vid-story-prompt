# Vidrial Routes

## Motion Studio

- `/prompts` — original HTML motion brief library, filters, real database metrics and approved entries.
- `/prompts/$slug` — shared resolver for data-defined collections (including `claude-opus-5-5`) and individual prompts; missing slugs return 404.
- `/claude-motion-graphics` — original gallery and private brief handoff to the app.
- `/blog/claude-motion-graphics` — normal validated Markdown article with allowlisted original prompt embeds.
- `/docs/motion-studio` — contract, prompts, limits, isolation and model privacy.
- `/app/motion`, `/app/motion/new`, `/app/motion/$projectId`, `/app/motion/gallery` — workspace-private project, brief, version/export and gallery surfaces. Actual schema/model/worker availability controls execution.

Public routes have unique canonical metadata; FAQ and VideoObject data describe only visible facts and verified clips. Library/demo provenance never implies a successful model call or hosted deployment. Signup redirects use an opaque browser draft identifier, never private text.

File-based routing via TanStack Router. Files live in `src/routes/`.
Dots in filenames map to URL slashes; `$param` is dynamic; underscore
prefixes are layout/pathless routes.

## Public marketing

| Path                       | File                          | Purpose                    |
| -------------------------- | ----------------------------- | -------------------------- |
| `/`                        | `index.tsx`                   | Home with interactive hero |
| `/features`                | `features.tsx`                | Feature grid               |
| `/how-it-works`            | `how-it-works.tsx`            | Three-step explainer       |
| `/pricing`                 | `pricing.tsx`                 | Plans + comparison table   |
| `/use-cases`               | `use-cases.index.tsx`         | Vertical hub               |
| `/use-cases/podcasts`      | `use-cases.podcasts.tsx`      | Podcast repurposing        |
| `/use-cases/courses`       | `use-cases.courses.tsx`       | Course clips               |
| `/use-cases/product-demos` | `use-cases.product-demos.tsx` | Demo reels                 |
| `/use-cases/short-form`    | `use-cases.short-form.tsx`    | Social shorts              |
| `/use-cases/youtube`       | `use-cases.youtube.tsx`       | YouTube clipper landing    |
| `/youtube-clipper`         | `youtube-clipper.tsx`         | Public clipper page        |
| `/blog`                    | `blog.index.tsx`              | Editorial blog index       |
| `/blog/$slug`              | `blog.$slug.tsx`              | Validated Markdown article |
| `/blog/category/$category` | `blog.category.$category.tsx` | Crawlable topic category   |

## Search discovery

`/sitemap.xml`, `/sitemap-pages.xml`, `/sitemap-blog.xml`, `/rss.xml`, and
`/robots.txt` are server-rendered discovery endpoints. Published article URLs
come only from validated, non-draft content with a PASS review status.

## Docs

| Path                    | File                       |
| ----------------------- | -------------------------- |
| `/docs`                 | `docs.tsx`                 |
| `/docs/getting-started` | `docs.getting-started.tsx` |
| `/docs/uploading-media` | `docs.uploading-media.tsx` |
| `/docs/ai-editor`       | `docs.ai-editor.tsx`       |
| `/docs/timeline`        | `docs.timeline.tsx`        |
| `/docs/exporting`       | `docs.exporting.tsx`       |

## Trust & legal

`/security`, `/ai-transparency`, `/roadmap`, `/changelog`, `/contact`,
`/status`, `/terms`, `/privacy`, `/cookies`, `/acceptable-use`,
`/copyright`, `/imprint`.

`/status` reads the sanitized source-access health server function. It does not
claim to monitor transcription, rendering or export availability. Worker URLs,
credentials and egress addresses remain server-side; individual job pages show
their own actual task outcomes.

## Auth

`/login`, `/signup`, `/forgot-password`, `/reset-password`,
`/verify-email`, `/auth/callback`, `/auth/youtube/callback`.

## Design

`/design-system` — live tokens, type scale, primitives.

## Authenticated app (`_authenticated` layout gate → `/login` if not signed in)

| Path                                      | File                                               |
| ----------------------------------------- | -------------------------------------------------- |
| `/app`                                    | `_authenticated.app.index.tsx`                     |
| `/app/projects`                           | `_authenticated.app.projects.index.tsx`            |
| `/app/projects/new`                       | `_authenticated.app.projects.new.tsx`              |
| `/app/projects/$projectId`                | `_authenticated.app.projects.$projectId.index.tsx` |
| `/app/projects/$projectId/editor`         | `.editor.tsx`                                      |
| `/app/projects/$projectId/media`          | `.media.tsx`                                       |
| `/app/projects/$projectId/transcript`     | `.transcript.tsx`                                  |
| `/app/projects/$projectId/versions`       | `.versions.tsx`                                    |
| `/app/projects/$projectId/exports`        | `.exports.tsx`                                     |
| `/app/templates`                          | `_authenticated.app.templates.tsx`                 |
| `/app/uploads`                            | `_authenticated.app.uploads.tsx`                   |
| `/app/usage`                              | `_authenticated.app.usage.tsx`                     |
| `/app/billing`                            | `_authenticated.app.billing.tsx`                   |
| `/app/help`                               | `_authenticated.app.help.tsx`                      |
| `/app/feedback`                           | `_authenticated.app.feedback.tsx`                  |
| `/app/settings/*`                         | `_authenticated.app.settings.*.tsx`                |
| `/app/youtube-clipper`                    | `_authenticated.app.youtube-clipper.index.tsx`     |
| `/app/youtube-clipper/new`                | `.new.tsx`                                         |
| `/app/youtube-clipper/jobs/$jobId`        | `.jobs.$jobId.tsx`                                 |
| `/app/youtube-clipper/clips/$clipId/edit` | `.clips.$clipId.edit.tsx`                          |

## Route conventions

- Every shareable route defines its own `head()` with unique `title`,
  `description`, `og:title`, `og:description`.
- `og:image` only at leaf routes, never on `__root.tsx`.
- Never edit `src/routeTree.gen.ts` — it is generated.

# Route map

- `/youtube-clipper` — public SEO page and official metadata preview.
- `/app/youtube-clipper` — authenticated job list.
- `/app/youtube-clipper/new` — three-step source (including rights), preferences
  and review wizard. The database-gated Exact Cut preference collects ordered
  timestamp ranges instead of an AI instruction; no separate creation route.
- `/app/youtube-clipper/clips/$clipId/edit` — shared editor for all origins. Exact
  Cut displays its paid-duration allowance and warns before a longer save uses
  additional processing seconds. Saved/restored versions activate through a
  scoped server-side database operation.
- `/app/youtube-clipper/jobs/:jobId` — durable realtime progress, events and partial results.
- `/app/youtube-clipper/clips/:clipId/edit` — persisted clip-version editor.
- `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password` — Supabase Auth flows with redirect preservation.

File routes follow `src/routes/README.md`. `src/routeTree.gen.ts` is generated only.

The current clipping wizard has three steps: source (including rights), clip preferences and review.

- `/app/automations` — verified automation rules and the trigger directory.
- `/app/automations/new` — source-trigger selection with honest availability.
- `/app/automations/:automationId` — automation rule details.
- `/auth/connectors/:connectorId/callback` — exact PKCE callback for Google Drive, Dropbox and OneDrive.
- `/app/settings/integrations` — connected sources, available sources, provider beta setup, publishing, developer and coming-soon connections.

## AI providers and chat

- `/app/settings/ai-providers` — connect, re-check, replace, revoke and delete provider keys; default model per feature; chat retention and permanent deletion.
- `/app/chat` — new chat (model picker, suggested prompts, optional clip-job context).
- `/app/chat/$threadId` — persisted conversation with streaming, Stop, Regenerate and edit-and-resend.
- `POST /api/ai/chat` — Server-Sent Events endpoint for one chat turn (same-origin, session-authenticated, duration-capped).
- `/docs/bring-your-own-key` — public explanation of what is stored and sent.
