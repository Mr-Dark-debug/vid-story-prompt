# Deployment

Deploy the TanStack Start web application to Vercel or Lovable with browser variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and server-only Supabase/provider/Turnstile variables from `.env.example`. Use encrypted platform environment variables; never commit `.env`.

Google sign-in, Supabase redirect URLs, and YouTube ownership OAuth are documented in [AUTHENTICATION.md](./AUTHENTICATION.md).

Cloudflare Turnstile requires `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and an explicit server-side hostname allowlist. Configure every supported production hostname in both Vercel and the Cloudflare widget:

```dotenv
TURNSTILE_ALLOWED_HOSTNAMES=vidrial.vercel.app,vid-story-prompt.vercel.app
```

`PUBLIC_APP_URL` is included automatically. Keep preview-deployment hostnames out of the allowlist unless they are intentionally supported and also registered in Cloudflare. Client error `110200` means the page hostname is missing from the Cloudflare widget configuration; changing only the Vercel variable does not repair that dashboard mismatch.

Deploy `services/video-worker/Dockerfile` independently to Railway, Render, Fly.io, Cloud Run or another Docker host. Configure 4 vCPU, 8 GB RAM, 20 GB ephemeral disk, one render per container, health `/healthz`, readiness `/readyz`, graceful shutdown and JSON log collection. Scale on queue wait/depth and CPU while respecting provider rate limits. This system is not expected to run indefinitely on free tiers.

For Render YouTube egress, the Blueprint also deploys `services/video-worker/warp/Dockerfile` as the Frankfurt `vidrial-warp-proxy` private service. It uses a pinned user-space WARP client because Render cannot grant the `NET_ADMIN` capability required by the official daemon pattern. It needs a persistent registration disk, private proxy port 8080, health port 8081, and a paid private-service instance; Render does not offer free private services. The video worker receives the Render-managed host through `WARP_PROXY_HOST`. Verify `/health/proxy` with the worker bearer secret after every revision. Do not expose the proxy service publicly.

If WARP cannot run on the selected container runtime or its egress is rejected, set an approved server-only `YTDLP_PROXY_URL` or use the same-job authorised-source handoff. Never copy a proxy URL into public Vercel variables or the browser bundle.

Schedule `enqueue_expired_clip_jobs` with Supabase Cron or an authenticated scheduler. Alert on dead letters, queue wait, failure/retry rate, storage growth, provider cost and readiness failures.

Connector OAuth additionally requires `CONNECTOR_TOKEN_ENCRYPTION_KEY` and provider credentials from `.env.example`. The encryption key must match on the web and worker. Provider consoles must allow only the exact production callback URLs. Do not enable a beta connector in the catalog until consent-screen review, token refresh, revocation, browsing and a real authorised import have been verified against the provider or documented sandbox.
