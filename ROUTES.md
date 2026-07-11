# Route map

- `/youtube-clipper` — public SEO page and official metadata preview.
- `/app/youtube-clipper` — authenticated job list.
- `/app/youtube-clipper/new` — four-step source, rights, settings and review wizard.
- `/app/youtube-clipper/jobs/:jobId` — durable realtime progress, events and partial results.
- `/app/youtube-clipper/clips/:clipId/edit` — persisted clip-version editor.
- `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password` — Supabase Auth flows with redirect preservation.

File routes follow `src/routes/README.md`. `src/routeTree.gen.ts` is generated only.
