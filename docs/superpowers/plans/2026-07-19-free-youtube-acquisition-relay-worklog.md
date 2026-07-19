# Free YouTube acquisition relay worklog — 2026-07-19

## Outcome

Implemented the repository-side architecture for measured cloud acquisition, optional extractor diversity, and an asynchronous free local recovery path. The normal clipping pipeline remains unchanged after a verified source asset is attached.

## Evidence and decisions

- Upstream yt-dlp guidance identifies blocked IPs as a separate failure that PO tokens cannot repair, and its extractor guidance no longer treats OAuth as download authentication.
- WARP registrations are measured and deduplicated by actual egress identity; registration count is never presented as guaranteed IP diversity.
- Render documents that free web services sleep, cannot receive private-network traffic, and are not intended for production. The free worker therefore uses a conservative embedded pool. Cobalt is an optional authenticated web service example, not a core dependency.
- Cobalt's current API uses authenticated `POST /`; hosted public instances are not used. The official 11.7.1 image is pinned, unmodified, and isolated as a separate AGPL service.
- Cookies are bearer-session credentials. Vidrial does not accept or store Google cookie jars; the advanced option remains local to the helper.

## Implemented

- Normalized acquisition attempts, relay devices, one-time pairings, relay requests, callback receipts, RLS, service-role RPCs, idempotent completion, and same-job validation resume.
- Configurable embedded/standalone WARP pools with separate registration data, pool health, HMAC egress fingerprints, uniqueness counts, and sanitized `/health/proxy` output.
- A pure bounded planner and worker runner covering operator override, development direct path, unique WARP/client combinations, one Cobalt attempt, terminal restriction handling, interruption recovery, and audited events.
- Current Cobalt adapter with API-key auth, strict timeout, response cap, circuit breaker, HTTPS-only returned media, existing SSRF/redirect/size controls, and FFmpeg section extraction.
- HMAC-scoped relay capabilities, single-use pairing, hashed device credentials, lease/heartbeat/complete/fail callbacks, signed Storage uploads, object-size verification, and immutable source attachment.
- Node 22 helper with cookie-free default, exact-section yt-dlp arguments, output containment and size checks, streaming checksum/upload, heartbeat, sanitized failure callback, and temporary-file cleanup.
- Responsive action-required UI, device pairing/revocation, local-cookie warning, expanded egress capacity badge, and session-deduplicated Realtime toasts.
- Realtime publication for relay-request state changes, so upload/completion/failure toasts are delivered without polling the page.

## Verification completed locally

- Supabase: the production project reports migration `20260719120000` applied; generated types contain 49 public tables. The Realtime publication follow-up is tracked separately as `20260719143000`.
- Worker: 78 tests, typecheck, and production TypeScript build passed.
- Helper: typecheck, 3 tests, and build passed.
- App: 217 tests passed with 6 skipped, typecheck passed, lint completed with zero errors (7 existing Fast Refresh warnings), and the production Vite/Nitro build passed.
- Docker/Compose was unavailable on this Windows host, so WARP and Cobalt container smoke tests are not claimed.

## Residual risk

- YouTube can block WARP or Cobalt egress. The free local helper changes the network class but still cannot guarantee every source.
- High-volume operators should supply `YTDLP_PROXY_URL` or dedicated compliant infrastructure. Multiple WARP identities consume memory and may share one measured address.
- Free Cobalt compute can cold-start and shares datacenter risk. Production operators should treat it as optional.
- WARP registrations and free services have bandwidth/resource limits. Health-based graceful degradation is intentional.
- Private, paid, DRM, age- and region-restricted media remains unsupported. Same-job original-source recovery is always retained.
