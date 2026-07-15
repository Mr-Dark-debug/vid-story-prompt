# Deployment

Deploy the TanStack Start web application to Vercel or Lovable with browser variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and server-only Supabase/provider/Turnstile variables from `.env.example`. Use encrypted platform environment variables; never commit `.env`.

Google sign-in, Supabase redirect URLs, and YouTube ownership OAuth are documented in [AUTHENTICATION.md](./AUTHENTICATION.md).

Deploy `services/video-worker/Dockerfile` independently to Railway, Render, Fly.io, Cloud Run or another Docker host. Configure 4 vCPU, 8 GB RAM, 20 GB ephemeral disk, one render per container, health `/healthz`, readiness `/readyz`, graceful shutdown and JSON log collection. Scale on queue wait/depth and CPU while respecting provider rate limits. This system is not expected to run indefinitely on free tiers.

Schedule `enqueue_expired_clip_jobs` with Supabase Cron or an authenticated scheduler. Alert on dead letters, queue wait, failure/retry rate, storage growth, provider cost and readiness failures.

Connector OAuth additionally requires `CONNECTOR_TOKEN_ENCRYPTION_KEY` and provider credentials from `.env.example`. The encryption key must match on the web and worker. Provider consoles must allow only the exact production callback URLs. Do not enable a beta connector in the catalog until consent-screen review, token refresh, revocation, browsing and a real authorised import have been verified against the provider or documented sandbox.
