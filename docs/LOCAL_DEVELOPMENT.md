# Local development

1. Copy `.env.example` to ignored `.env` and fill local values.
2. Install dependencies with `bun install` and `bun install --cwd services/video-worker`.
3. Install Docker Desktop, then run `npm run supabase:start` and `npm run supabase:reset`.
4. Generate types with `npm run supabase:types`.
5. Run the web app with `npm run dev` and the worker with `npm run worker:dev`.

FFmpeg/FFprobe and Docker were not available on the original Windows audit host. Worker media integration tests therefore require Docker or local FFmpeg before they can be verified there.

For connector development, apply all migrations and configure only the provider being tested. Register these exact callbacks: `/auth/connectors/google_drive/callback`, `/auth/connectors/dropbox/callback`, and `/auth/connectors/onedrive/callback`. Browsing can be tested without spending source minutes. A remote import requires the worker and the private `source-media` bucket. Never use production provider accounts in automated tests.
