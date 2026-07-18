# Clipping Reliability and UI Consolidation Design

## Status

Approved direction on 2026-07-18. This specification coordinates the mobile Turnstile repair, YouTube source acquisition reliability, task-derived progress, processing-event presentation, clipping wizard cleanup, integration settings consolidation, and straight dual connector marquee.

It supersedes conflicting parts of earlier designs that treated every YouTube sign-in response as an age restriction or prohibited the authorised worker from acquiring eligible YouTube media. The current repository rules allow server-side `yt-dlp` acquisition after rights attestation, entitlement checks, and the existing download security controls. Browser code never receives `yt-dlp`, provider credentials, raw download URLs, or worker secrets.

## Objective

Make the authenticated clipping flow reliable and understandable from signup through completed clips:

- Mobile users can recover from Turnstile network, timeout, duplicate-token, and hostname failures.
- Eligible public or unlisted YouTube sources can be acquired by the isolated worker without requiring a browser upload.
- Provider anti-bot or transient sign-in challenges are not mislabeled as age restrictions.
- Retryable work retries automatically and can be retried manually through a real authorized action.
- Job status, progress stages, and events reflect durable queue/task state rather than guessed percentages.
- The jobs list, job detail, wizard, and integrations settings share consistent semantic components.
- Connector settings are presented once from the central registry, with safe dialogs and unsaved-change protection.
- The marketing connector marquee uses two straight, full-width, opposing tracks.

## Verified failure evidence

The production job `e9fae8a0-a9d0-49d3-b10b-2c7f9d2df912` failed while acquiring YouTube video `XzXM7V7t4ts`. The `download_youtube_source` task ran for about eight seconds, recorded one attempt, and ended with `video_restricted`. Its only event stated that the video required sign-in or was age-restricted.

The worker currently combines any stderr containing `sign in` or `age-restricted` into the same non-retryable error. This loses the distinction between a true policy restriction and YouTube bot/IP challenges, prevents the queue's remaining attempts from running, and gives the user incorrect guidance.

The current job-detail progress component derives its active stage from `clip_jobs.status`. Terminal states such as `failed` and `cancelled` are not processing stages, so a failed job renders every stage as pending. The job-detail service does not return `job_tasks`, and the visible retry action has no handler.

Turnstile currently discards the client error code, does not expose a controlled reset API, discards Siteverify `error-codes`, and compares the verified token hostname to one `PUBLIC_APP_URL` hostname. A valid production alias can therefore be rejected even when the widget and secret are configured correctly.

The integrations route renders the registry-driven connector catalog and then renders separate YouTube, TikTok, and Instagram sections. The wizard adds a raised provider panel inside the main step panel. The marketing marquee paths are cubic curves rather than horizontal lines.

## Selected approach

Use a coordinated reliability pass rather than a visual-only patch or a queue rewrite.

The existing PostgreSQL queue, worker leasing, job state machine, connector registry, rights attestation, and security boundaries remain authoritative. Changes add missing error classification, retries, task visibility, user actions, and reusable presentation primitives around those foundations.

## Mobile Turnstile reliability

### Browser behavior

The reusable Turnstile component will:

- accept the error code supplied by Cloudflare's `error-callback`;
- classify retryable client errors, including load, generic challenge, timeout, and interaction timeout families;
- show concise, actionable feedback instead of a generic failure;
- reset or re-render the widget after an expired, duplicate, timed-out, or retryable failure;
- invalidate the previous token whenever the widget resets;
- avoid retry loops by using a bounded automatic reset and a visible manual retry action;
- preserve keyboard access, screen-reader status announcements, and mobile-width layout.

The component must not bypass verification when production Turnstile configuration exists. Automated browser checks may confirm rendering and error recovery but must not attempt to solve a CAPTCHA.

### Server verification

Siteverify parsing will preserve safe `error-codes` and map them to typed results. Logs may contain the error category and request correlation ID but never the token, secret, email, or IP address.

Production hostname validation will use an explicit comma-separated `TURNSTILE_ALLOWED_HOSTNAMES` allowlist. The canonical hostname from `PUBLIC_APP_URL` is always included, and localhost remains limited to development. The request hostname is not trusted as an implicit addition to the allowlist.

Vercel configuration will list every supported production alias. If Cloudflare returns domain error `110200`, the same aliases must also be added to the Turnstile widget's hostname allowlist in the Cloudflare dashboard; this external configuration step will be reported separately rather than fabricated as a code change.

Tokens remain single-use and short-lived. Duplicate or expired verification produces a recoverable response that forces a fresh widget token.

## YouTube acquisition reliability

### Failure taxonomy

The worker will classify bounded, redacted `yt-dlp` failures into at least:

- `video_private`: confirmed private or permission-denied source; terminal.
- `video_age_restricted`: confirmed age-gated source that cannot be acquired by the configured authorised flow; terminal.
- `video_unavailable`: deleted, geo-blocked, live-only, or otherwise confirmed unavailable; terminal unless the extractor marks it temporary.
- `provider_auth_challenge`: sign-in-to-confirm, bot verification, or PO-token challenge; retryable.
- `provider_rate_limited`: HTTP 429 or equivalent throttling; retryable with backoff.
- `provider_temporary_failure`: extractor, network, timeout, or 5xx failure; retryable.
- `source_limit_exceeded`: duration, size, redirect, DNS/IP, or format policy failure; terminal with the existing actionable limit message.
- `provider_configuration_error`: missing runtime, incompatible plugin, or invalid worker configuration; terminal for the task and visible to operators without exposing secrets.

Classification is based on narrow patterns and exit context. Raw stderr is never stored in product events or returned to the browser.

### Acquisition strategy

The first attempt keeps the bounded standard YouTube extractor with the packaged JavaScript runtime. For eligible retryable authentication challenges, the worker may use a second fixed strategy based on the official yt-dlp PO-token guidance: a pinned worker-only PO-token provider and compatible `mweb` client configuration.

The provider, plugin, and yt-dlp versions are pinned and compatibility-tested in the Docker image. No browser-side binary, end-user cookies, shared account cookies, arbitrary proxy input, or unbounded extractor arguments are introduced. A failed fallback remains a classified provider failure; the UI never claims that every YouTube video is downloadable.

Every attempt continues to enforce rights attestation, workspace entitlement, DNS/IP/redirect restrictions, duration and size limits, timeouts, FFprobe validation, immutable private storage paths, leases, heartbeats, cancellation, and idempotency.

### Retry behavior

Retryable acquisition failures use the existing `retry_wait` state and maximum-attempt contract with bounded exponential backoff and jitter. Terminal policy/source failures stop immediately. Each attempt emits a sanitized event containing stage, attempt number, severity, safe error code, and recovery guidance.

A new server-authorized manual retry operation will call a transactional PostgreSQL RPC. The RPC will:

- verify the current workspace member may mutate the job;
- select the failed or dead task under a row lock;
- reject completed, cancelled, currently leased, or ineligible terminal-policy tasks;
- ensure another task with the same idempotency key is not active;
- clear lease and safe error fields, move the task to `queued`, reset the job's terminal error state, and create the outbox/event records atomically;
- preserve attempt history and enforce the configured attempt ceiling;
- wake the worker after commit, with wake failure recorded as a warning while the durable task remains queued.

The job-detail retry control appears only when this operation is actually available.

## Task-derived progress and events

The job-detail service will return the current job, clips, exports, sanitized events, and the job's task projections. Task projections include type, status, attempt counts, timestamps, safe error code, and progress fields but never payload URLs, tokens, leases, or private filenames.

A domain-level progress mapper will derive display stages from task types and durable job state:

1. Awaiting source
2. Queued
3. Validating
4. Creating proxy
5. Extracting audio
6. Transcribing
7. Analysing
8. Planning
9. Rendering previews
10. Ready

Each stage is one of `completed`, `active`, `retrying`, `failed`, or `pending`. A failed job retains completed stages and marks the actual failed stage red. A retry-wait task marks its stage amber and shows its next attempt. Cancelled work retains completed stages and marks remaining stages neutral. Percentages are shown only when backed by worker progress; otherwise the UI uses named stages without invented completion values.

The processing-event list becomes a compact timeline. Each row includes a semantic icon, human stage name, message, attempt badge when applicable, timestamp, and severity treatment. Safe technical codes may appear in an expandable detail region, while raw snake-case codes never become the primary user message. Events are rendered chronologically for narrative flow, with the newest state announced accessibly.

## Reusable status presentation

Add one reusable job-status mapping and badge used by both the job list and job detail:

- ready, completed, and partially ready: semantic success;
- active processing stages: controlled coral/info treatment with a reduced-motion-safe activity indicator;
- queued, draft, and awaiting source: cool informational treatment;
- retry wait and warnings: semantic warning;
- failed and dead: semantic danger;
- cancelled and expired: neutral muted treatment.

Labels are human-readable and never expose database enum values. Status color is always paired with text and/or an icon.

## Clipping wizard layout

The outer wizard step remains the single main surface. The selected YouTube controls are flattened into that surface:

- source selector;
- YouTube URL label, input, loading, and validation feedback;
- compact metadata preview when available;
- rights confirmation;
- primary action bar.

The redundant raised provider container is removed. The compact preview may retain one restrained sub-surface because it represents a distinct media result, not another form container.

Steps two and three use explicit responsive grids with consistent control heights, label spacing, help-text space, and row alignment. Related two-column fields share row minimum heights on desktop and stack in document order on mobile. The action bar aligns consistently across steps and remains reachable on small screens. Existing entitlement-aware clip-count disabling and structured plan-limit dialogs remain authoritative.

## Integration settings consolidation

`src/domain/connectors/registry.ts` remains the only connector catalog. The integrations route renders each connector once and removes the standalone duplicate YouTube, TikTok, and Instagram blocks.

Selecting a connector opens a reusable `ConnectorSettingsDialog`:

- identity, status, capabilities, availability, and supported actions come from the registry and live connection state;
- available import connectors may navigate to the source flow;
- YouTube connection and automation settings render inside the dialog without exposing tokens;
- coming-soon connectors can record interest but never simulate OAuth, connection, import, or publishing;
- publishing and automation permissions remain separate from import permission.

The dialog tracks its saved snapshot and current draft. Closing a dirty dialog opens a reusable confirmation dialog with `Continue editing`, `Discard changes`, and `Save changes`. Save is disabled while validation fails. Successful save updates the saved snapshot before closing. Disconnect and other destructive operations use the same confirmation family with destructive semantics.

## Straight dual marquee

The connector marquee keeps two registry-driven, endlessly repeating rows moving in opposite directions. Both SVG paths become horizontal line paths with matching view boxes and no cubic or quadratic control points. Tiles retain deliberate spacing, the full-viewport breakout, side/top/bottom fades, reduced-motion behavior, and a single assistive announcement set.

The previous circular turn and curved track are removed. Both rows enter before the left viewport edge and leave after the right edge so motion appears continuous across the device.

## Data, migration, and compatibility

Database changes are limited to the manual-retry RPC and any indexes or constraints required to make that transition atomic. Existing status enums, task leasing, outbox, rights attestations, storage paths, and entitlement seeds remain unchanged unless a failing test proves an explicit compatibility migration is necessary.

The task projection is exposed only through authenticated server services. RLS and workspace authorization remain enforced independently of client visibility.

New environment configuration:

- `TURNSTILE_ALLOWED_HOSTNAMES` on Vercel/server environments.
- Worker-only PO-token provider settings if the pinned fallback requires them; no secret or permanent provider credential is added to the client.

## Testing

### Application unit and component tests

- Turnstile client error classification, bounded reset, expiry, and token invalidation.
- Siteverify error mapping and allowed-hostname validation.
- Job-status badge mapping for every domain status.
- Task-to-stage progress mapping for success, retry wait, failure, cancellation, and ready states.
- Event timeline ordering and accessible severity presentation.
- Wizard flattened source layout and symmetric preferences/review grids.
- Registry-driven integration rendering without duplicate connectors.
- Connector dialog dirty-state save, discard, continue-editing, and destructive confirmation flows.
- Straight marquee path, two opposing directions, registry content, and four-edge fade.

### Database and server integration tests

- Manual retry authorization and workspace isolation.
- Row-lock/idempotency behavior under concurrent retry requests.
- Rejection of ineligible terminal, active, cancelled, and exhausted tasks.
- Atomic job/task/outbox/event transition and worker wake warning behavior.
- Task projections exclude private payload fields.

### Worker tests

- Fixture-based classification for private, age-restricted, unavailable, sign-in/bot challenge, rate limit, timeout, 5xx, size, and duration failures.
- Retry scheduling and terminal classification.
- Fixed primary/fallback argument construction and redaction.
- Docker image contains compatible pinned yt-dlp, JavaScript runtime, FFmpeg/FFprobe, and PO-token provider when enabled.
- Cancellation, lease heartbeat, temporary-file cleanup, FFprobe validation, and immutable upload behavior remain intact.

### Browser and production verification

- Mobile-width signup renders Turnstile and recovers from a simulated retryable error without solving the challenge automatically.
- A user-completed production challenge succeeds on every supported hostname; domain errors are reconciled with the Cloudflare dashboard allowlist.
- Create an authorised clipping job for a controlled public test video without uploading the source.
- Observe queue claim, acquisition, progress stages, events, clip generation, and final ready state.
- Exercise one safe transient retry and one authorized manual retry.
- Verify jobs list colors, flattened wizard, aligned steps, connector dialogs, unsaved-change warning, and straight marquee at desktop and mobile widths.
- Check Vercel, Supabase, and Render logs for errors and secret leakage.

Provider live verification is reported separately from mocked tests. A successful local or mocked extractor test is not described as production YouTube success.

## Release sequence

1. Add Turnstile error/hostname handling and focused tests.
2. Add worker failure taxonomy, retry behavior, optional pinned PO-token fallback, and worker tests.
3. Add the transactional manual-retry migration and authenticated server wrapper.
4. Add task projections, progress mapping, event timeline, and semantic job badges.
5. Flatten and align the clipping wizard.
6. Consolidate integrations into registry-driven dialogs with dirty-state protection.
7. Straighten and verify the dual marquee.
8. Run typecheck, lint, application tests, application build, worker type/tests/build, relevant Supabase integration tests, and browser checks.
9. Commit and push normal history to `main`, allow connected deployments, apply the migration, configure new environment values, and verify production end to end.

No force push, rebase, amend, or squash is used. Missing provider credentials, Cloudflare dashboard access, Docker runtime, or live deployment verification is reported explicitly.

## Acceptance criteria

- Mobile signup does not become permanently blocked after a retryable Turnstile failure.
- Supported production aliases pass explicit server hostname validation.
- A YouTube bot/sign-in challenge is not shown as an age restriction.
- Retryable acquisition failures use remaining attempts; terminal source restrictions do not loop.
- The manual retry control performs a real authorized, idempotent queue transition.
- Failed jobs preserve completed progress and identify the actual failed stage.
- Event logs are chronological, semantic, readable, and free of raw secrets or URLs.
- Every job state has a consistent text-and-color badge across list and detail views.
- The source step has no redundant provider container, and steps two and three are aligned responsively.
- Each connector appears once on integrations settings and opens the reusable dialog.
- Dirty connector changes cannot be lost without save/discard confirmation.
- The two marquee rows are completely straight and move endlessly in opposite directions.
- An authorised public YouTube test job is verified end to end in production or any remaining external provider block is documented precisely without claiming success.

## References

- [Cloudflare Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Cloudflare Turnstile client-side errors](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/)
- [yt-dlp external JavaScript runtime guidance](https://github.com/yt-dlp/yt-dlp/wiki/EJS)
- [yt-dlp PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)
- [yt-dlp extractor notes](https://github.com/yt-dlp/yt-dlp/wiki/Extractors)
