# Deployment

## Blog search discovery

The blog and discovery endpoints use `https://vidrial.vercel.app` as the fixed canonical production origin. Production must keep `PUBLIC_APP_URL=https://vidrial.vercel.app` so request redirects agree with article canonical URLs.

Optional public ownership tokens:

- `VITE_GOOGLE_SITE_VERIFICATION`
- `VITE_BING_SITE_VERIFICATION`

IndexNow deployment reconciliation additionally requires a server-only `INDEXNOW_TRIGGER_SECRET` of at least 32 characters and `SUPABASE_SERVICE_ROLE_KEY` for its private submission log. Never expose the trigger secret in a `VITE_` variable. See [SEO_OPERATIONS.md](./SEO_OPERATIONS.md) for the dry-run-first publication workflow and authenticated webmaster-console steps.

Deploy the TanStack Start web application to Vercel or Lovable with browser variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and server-only Supabase/provider/Turnstile variables from `.env.example`. Use encrypted platform environment variables; never commit `.env`.

Google sign-in, Supabase redirect URLs, and YouTube ownership OAuth are documented in [AUTHENTICATION.md](./AUTHENTICATION.md).

Cloudflare Turnstile requires `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and an explicit server-side hostname allowlist. Configure every supported production hostname in both Vercel and the Cloudflare widget:

```dotenv
TURNSTILE_ALLOWED_HOSTNAMES=vidrial.vercel.app,vid-story-prompt.vercel.app
```

`PUBLIC_APP_URL` is included automatically. Keep preview-deployment hostnames out of the allowlist unless they are intentionally supported and also registered in Cloudflare. Client error `110200` means the page hostname is missing from the Cloudflare widget configuration; changing only the Vercel variable does not repair that dashboard mismatch.

Verify both `/login` and `/signup` after every hostname or Turnstile change. The normal result is a
brief “Checking browser security...” status followed by “Browser security checked”; the full widget
must only appear when Cloudflare requests interaction. Check at 360px as well as desktop width.
Vidrial validates Siteverify itself, so Supabase's separate CAPTCHA toggle must remain off to avoid
redeeming the same single-use token twice.

Deploy `services/video-worker/Dockerfile` independently to Railway, Render, Fly.io, Cloud Run or another Docker host. Configure 4 vCPU, 8 GB RAM, 20 GB ephemeral disk, one render per container, health `/healthz`, readiness `/readyz`, graceful shutdown and JSON log collection. Scale on queue wait/depth and CPU while respecting provider rate limits. This system is not expected to run indefinitely on free tiers.

### Credential-gated social publishing

Set the same `CONNECTOR_TOKEN_ENCRYPTION_KEY` on the web application and worker. Add only providers you have actually registered and reviewed:

- Meta: `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION=v25.0`
- TikTok: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, and `TIKTOK_CONTENT_POSTING_AUDITED=false` until TikTok confirms the Content Posting audit
- LinkedIn: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_API_VERSION=202605`

Configure each exact callback as `${PUBLIC_APP_URL}/auth/connectors/<connector>/callback`. Missing credentials intentionally leave that connector non-executable. Never set an audit or review flag based only on a successful development-mode upload.

The active Render Blueprint includes the free `vidrial-cobalt` fallback and passes its API URL/key to the worker with `fromService`. Create a fresh UUIDv4 for the new service's `COBALT_API_KEY`; existing Blueprint syncs do not populate newly added `sync: false` secrets automatically. Free services sleep and use datacenter egress, so Cobalt improves extractor diversity but does not guarantee source acquisition. Confirm `tiers.cobalt.state=ready` through the worker's bearer-protected `/health/proxy` without logging the key.

The intended higher-reliability Render YouTube egress option is `services/video-worker/warp/Dockerfile` as the Frankfurt `vidrial-warp-proxy` private service. It uses a pinned user-space WARP client because Render cannot grant the `NET_ADMIN` capability required by the official daemon pattern. It needs a persistent registration disk, private proxy port 8080, health port 8081, and a paid private-service instance; Render does not offer free private services. The video worker receives the Render-managed host through `WARP_PROXY_HOST`. This is an operator cost decision: persistent registration and more memory improve stability, while the current free two-member embedded pool has no monthly compute charge but sleeps and is more easily exhausted. Verify `/health/proxy` with the worker bearer secret after every revision. Do not expose the proxy service publicly.

If protected-pool egress is rejected, set an approved server-only `YTDLP_PROXY_URL` using `http(s)://` or `socks5(h)://` syntax, restart the worker, and require `tiers.operator_proxy.state=ready` before relying on it. Never copy a proxy URL into public Vercel variables, browser bundles, events, screenshots, or logs. If no operator endpoint is available, the same-job authorised-source handoff remains the final recovery.

Schedule `enqueue_expired_clip_jobs` with Supabase Cron or an authenticated scheduler. Alert on dead letters, queue wait, failure/retry rate, storage growth, provider cost and readiness failures.

Connector OAuth additionally requires `CONNECTOR_TOKEN_ENCRYPTION_KEY` and provider credentials from `.env.example`. The encryption key must match on the web and worker. Provider consoles must allow only the exact production callback URLs. Do not enable a beta connector in the catalog until consent-screen review, token refresh, revocation, browsing and a real authorised import have been verified against the provider or documented sandbox.
