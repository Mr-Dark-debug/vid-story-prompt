# YouTube Acquisition Resilience Design

## Status

Approved for uninterrupted implementation on 2026-07-18. This design reconciles the user-provided WARP task brief with the attached authorised-source recovery report and the incomplete recovery work already present in the working tree.

## Objective

Make YouTube clipping truthful and resilient without weakening Vidrial's workspace, usage, queue, or media-security boundaries:

- try bounded server-side acquisition through a configured egress path;
- preserve the existing yt-dlp client rotation, IPv4 enforcement, PO-provider compatibility, and `YTDLP_PROXY_URL` escape hatch;
- expose sanitized worker-egress health without leaking proxy URLs, credentials, or raw egress details to browser code;
- make acquisition failures recoverable on the same job with an authorised original source;
- keep YouTube OAuth exclusively for Data API channel, upload, playlist, automation, and publishing capabilities;
- reduce transfer size only when an exact source section is actually known before acquisition;
- keep every retry and recovery transition idempotent, auditable, and cancellation-aware.

## Evidence and corrected assumptions

The current worker is healthy and fails before FFmpeg, transcription, planning, or rendering receives a source. The repository already rotates fixed yt-dlp clients and supports a server-only proxy URL. The uncommitted work adds `awaiting_authorised_source`, same-job attachment RPCs, task supersession, and an inline recovery component; it must be completed rather than overwritten.

Upstream evidence supports IP-level blocking as one failure class, but not as the only possible class:

- yt-dlp's PO-token guide says manually supplied tokens are no longer recommended because tokens are content-bound; automatic provider plugins remain recommended for clients that require them.
- yt-dlp's extractor guide says OAuth no longer authenticates yt-dlp downloads.
- yt-dlp issue 16747 includes a reproducible report where changing to a mobile-hotspot IP fixes the same media request.
- Render private networking provides stable internal hostnames only for services in the same workspace and region.
- YouTube API policies prohibit API clients from downloading or storing YouTube audiovisual content without prior written approval. Rights attestation does not by itself grant YouTube platform approval, so the product must retain the authorised-original path and must not promise universal retrieval.

The task brief contains implementation assumptions that do not match the current repository or platform:

- Cloudflare publishes the official WARP Linux client through Debian/Ubuntu and RPM repositories, not Alpine `apk`; the sidecar will therefore use `debian:bookworm-slim`.
- `cmj2002/warp-docker` is GPL-3.0, not MIT. Vidrial will use an original entrypoint built from Cloudflare's official CLI behavior rather than copy that implementation.
- Render private services cannot use the free plan. The WARP software is free, but a private `pserv` requires paid Render compute.
- the current clipping wizard asks AI to discover clip ranges after transcription. `--download-sections` cannot reduce the initial source acquisition when no range exists yet. The worker will support exact range acquisition when a validated `sourceSection` is present, and tests/documentation will not claim that ordinary AI-discovery jobs use it.

## Considered approaches

### WARP only

Route every production YouTube request through WARP and leave exhausted jobs failed. This is the smallest path to test IP-block evidence, but it is brittle if WARP is unavailable or later blocked, adds an external network dependency, and does not resolve restricted, private, age-gated, region-locked, or policy-denied media.

### Authorised source only

Remove automatic media acquisition and require an original file or owner-controlled URL. This is operationally reliable and aligns best with the attached report, but it abandons the explicitly requested public-URL acquisition path and existing worker investment.

### Hybrid acquisition plus same-job recovery (selected)

Keep bounded acquisition, add explicit proxy tiers and health, and transition exhausted safe failures to `awaiting_authorised_source`. This gives eligible URLs the fastest path while ensuring the job, metadata, settings, rights record, usage reservation, completed artifacts, and event history survive provider rejection.

## Architecture

### Proxy configuration and health

`resolveYouTubeProxy` is a pure worker function with this precedence:

1. `YTDLP_PROXY_URL` user/operator override.
2. `WARP_PROXY_URL` explicit WARP service URL.
3. Render-internal WARP URL assembled from `WARP_PROXY_HOST` and port when production wiring is present.
4. no proxy in development.

Production does not silently fall back when a configured proxy is unreachable. The worker becomes not-ready for acquisition, records a redacted startup error, and continues exposing health so operators can repair configuration. Direct egress remains available only when production has no proxy configuration and the job is not `forceProxy`; this state is degraded and loudly logged.

The worker passes a selected proxy both as yt-dlp's `--proxy` option and as subprocess `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, and lowercase equivalents. Credentials remain in worker memory and are redacted from logs and responses.

The protected `/health/proxy` endpoint returns operator data only after the same bearer authentication used by `/wake`: configured tier, reachability, WARP trace state, redacted egress IP, last check time, and last yt-dlp probe result. An authenticated TanStack server function calls it and returns only `{ status, tier, checkedAt, message }` to the browser. The proxy URL and egress IP never enter the browser response.

Startup performs a bounded Cloudflare trace check and a yt-dlp format probe for the controlled test video through the selected proxy. Probe output is redacted. A configured but unreachable proxy fails readiness; an unavailable YouTube test video marks egress degraded without crashing unrelated queue/health handling.

### WARP private service

`services/video-worker/warp/` contains an original Debian slim image, entrypoint, health script, README, and local Compose smoke test. It installs Cloudflare's signed official package, a pinned GOST release with checksum verification, curl, dbus, and minimal runtime dependencies. Startup accepts Cloudflare's application terms explicitly, starts `warp-svc`, registers only when no persisted identity exists, switches to local proxy mode before connecting, and exposes an HTTP CONNECT listener on `0.0.0.0:8080` forwarding to WARP's local SOCKS port.

The image healthcheck requires `warp=on` or `warp=plus`. Registration state is stored on a Render persistent disk to avoid generating a new identity on every deploy. The Render Blueprint creates a Frankfurt private service on a paid starter plan, exposes port 8080 only to the private network, and injects its internal host into the worker through a service property reference.

If Render rejects the WARP daemon because the runtime does not provide required kernel/device capabilities, deployment is reported as blocked rather than fabricated as healthy. The documented operational alternative is a user-supplied `YTDLP_PROXY_URL` or the authorised-source recovery path.

### Acquisition retries and audit trail

The existing fixed player-client rotation remains the direct/client strategy. A pure attempt planner chooses one of these egress tiers:

- direct/client rotation when permitted;
- WARP after client attempts are exhausted or `forceProxy` is true;
- `YTDLP_PROXY_URL` as the highest-priority operator route, not as a duplicate retry after itself already failed.

Each attempt writes a sanitized processing event with `proxy_tier`, strategy, attempt, and safe error code. `processing_events`—the repository's actual event table—receives a nullable constrained `proxy_tier`; browser projections expose the label but never URLs or credentials.

The retry RPC accepts `force_proxy` only as a boolean. It never accepts a browser-supplied proxy. The job/task input records this flag server-side, and the worker skips direct egress when it is set.

### Exact-section acquisition

`buildYouTubeDownloadArgs` accepts an optional validated `{ startSeconds, endSeconds }`. When present it adds `--downloader ffmpeg` and `--download-sections *START-END`; bounds must be finite, non-negative, ordered, and within the reserved source duration. Because the current AI workflow discovers clip ranges after acquiring and transcribing the source, ordinary jobs omit this option. No UI or telemetry will claim bandwidth savings for jobs without a preselected range.

### Same-job authorised-source recovery

Final acquisition failures that can be recovered with a user-controlled file transition to `awaiting_authorised_source`, not terminal `failed`. Private, age/region-restricted, removed, or provider-blocked media receive specific copy and the same recovery surface; no attempt is made to bypass account, region, or age controls.

The transactional attachment RPC:

- verifies authenticated user and workspace ownership;
- accepts only `awaiting_authorised_source` jobs;
- validates asset/import ownership and readiness;
- enforces idempotency-key reuse rules;
- records source provenance and preliminary duration confidence;
- marks the acquisition task `superseded` without deleting history;
- queues a new `validate_source` task with a unique idempotency key;
- preserves settings, metadata, usage reservation, and completed artifacts;
- returns the existing result on duplicate requests.

The worker uses FFprobe for the authoritative duration/stream match. A low-confidence mismatch returns to `awaiting_authorised_source` and requires explicit user confirmation. A confirmed shorter source may continue; a longer source that exceeds reserved usage must be rejected or re-reserved atomically rather than silently exceeding entitlement.

### UI and OAuth truthfulness

The connector dialog presents two explicit sections:

- **Connect YouTube account** — optional Data API access for channels, uploads, playlists, automation, and publishing. It does not enable URL downloads.
- **Clip a YouTube URL** — no account connection required for eligible public/unlisted URLs. Availability depends on worker egress and provider policy; an original upload remains the reliable fallback.

The clipping wizard shows a compact `WorkerEgressBadge` sourced from the sanitized server function. Healthy is green, degraded is amber, and blocked is red; color is paired with text and an icon. The badge does not expose proxy URLs, egress IPs, or secrets. A failed eligible job offers **Retry through protected egress**, which calls the force-proxy retry RPC. Exhausted or restricted jobs render the existing same-job authorised-source panel.

All copy uses Vidrial's semantic tokens, Manrope fallback, controlled coral accent, and responsive layouts down to 360px.

## Error handling

- `proxy_configuration_error`: invalid proxy URL or conflicting configuration; operator-visible, browser-safe.
- `proxy_unreachable`: configured proxy failed trace/connectivity; readiness false, no direct fallback.
- `provider_auth_challenge` / media HTTP 403: retry through the planned proxy tier, then request an authorised source.
- `provider_rate_limited`: bounded backoff and tier escalation; no infinite retries.
- private, age-restricted, region-locked, removed, or live media: no bypass; clear recovery copy.
- WARP health unknown: degraded badge and no claim of successful protected egress.

Raw URLs, tokens, filenames, proxy credentials, transcripts, and yt-dlp stderr never enter product analytics or browser responses.

## Verification

Local verification covers pure proxy precedence, forced-proxy planning, environment propagation, argument construction, redaction, health endpoint authentication, exact-section bounds, recovery state transitions, attachment idempotency, workspace isolation, mismatch confirmation, UI copy, badge states, and 360px rendering.

Repository checks are `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm --prefix services/video-worker run typecheck`, `npm --prefix services/video-worker test`, and `npm --prefix services/video-worker run build`, plus relevant Supabase and Playwright tests.

The WARP Compose smoke test is run only when Docker is available. This machine currently has no Docker executable, so absence is reported unless Docker becomes available through the desktop environment.

Production verification requires authenticated Vercel, Supabase, Render, and application access. Success is claimed only when the deployed worker reports a protected egress probe, a real job event shows the selected proxy tier, and a clip/export completes. Missing credentials, Render capability rejection, provider rejection, or deployment gating is reported precisely.

## Residual risks

- YouTube can block Cloudflare WARP addresses or change extractor requirements.
- Cloudflare may limit, suspend, or change WARP application behavior; it is not a guaranteed production egress SLA.
- Render private service compute is paid even though WARP software is free.
- high-volume use requires a separately approved egress strategy; this design does not automate identity rotation or evade service limits.
- WARP does not and must not bypass private, age, region, rights, or account restrictions.
- `YTDLP_PROXY_URL` remains the operator escape hatch, while authorised-source attachment remains the product-level fallback.

## Sources

- https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide
- https://github.com/yt-dlp/yt-dlp/wiki/Extractors
- https://github.com/yt-dlp/yt-dlp/issues/16747
- https://github.com/yt-dlp/yt-dlp/issues/15750
- https://github.com/yt-dlp/yt-dlp/blob/master/README.md
- https://render.com/docs/private-network
- https://render.com/docs/private-services
- https://render.com/docs/blueprint-spec
- https://developers.cloudflare.com/warp-client/warp-modes/
- https://www.cloudflare.com/application/terms/
- https://developers.google.com/youtube/terms/developer-policies

