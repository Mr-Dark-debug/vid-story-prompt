# YouTube integration and automation design

## Status

Approved for implementation on 2026-07-13. This specification extends the existing YouTube Clipper design without weakening its authorised-media boundary.

## Goals

Vidrial will provide a real YouTube integration that can:

- Connect and disconnect a user's YouTube channel through Google OAuth.
- Show the connected channel, granted capabilities, token health, and automation status.
- Detect uploads from a connected channel using YouTube's official push-notification service.
- Automatically create a clipping draft for a detected upload.
- Automatically start processing when Vidrial already has an authorised source asset for that upload.
- Let the user schedule or immediately publish completed exports to their connected YouTube channel.
- Use official or maintained brand assets for every integration card.
- Clearly distinguish working integrations from future integrations.

The integration remains optional for ordinary clipping. A user can create clips without connecting YouTube when they provide an authorised upload or owner-controlled HTTPS media URL.

## Non-goals and policy boundary

This implementation will not download, scrape, proxy, or otherwise obtain source media from a YouTube watch URL. The YouTube Data API provides metadata, account data, notifications, and authenticated upload operations; it does not provide the original uploaded media file.

A pasted YouTube URL therefore has two possible roles:

1. It supplies official metadata that can be associated with an authorised source asset.
2. For a connected channel, it can establish that the user manages the referenced channel.

Neither role substitutes for source media or permission to process it. Every processing job continues to require a versioned rights attestation and one of:

- A user-uploaded media asset.
- An owner-controlled HTTPS media URL that passes the existing SSRF and media validation boundary.
- A source asset already stored by Vidrial, such as media uploaded through a future Vidrial-to-YouTube workflow.

When a connected channel publishes a video outside Vidrial, the notification creates an automation draft in `awaiting_source` state. The user can attach the original file and continue. When Vidrial already holds the matching source asset, the automation can submit the clipping job without another upload.

## User experience

### Integrations settings

`/app/settings/integrations` becomes a data-backed page rather than a list of placeholder buttons.

The YouTube card is the only active social integration in this phase. It uses an official YouTube icon following the YouTube API branding guidelines. Its icon links to the relevant YouTube channel or feature. The card shows:

- Disconnected, connected, reconnect required, or configuration unavailable status.
- Connected channel avatar, title, channel ID, and connection time.
- Read-channel and publish-video capability badges.
- Connect, reconnect, grant publishing access, manage automation, and disconnect actions.
- A concise explanation that connecting is unnecessary for manual clipping.

TikTok and Instagram cards use maintained brand icons from a React icon package and show `Coming soon`. They do not show working Connect buttons or imply that credentials can currently be stored. Placeholder Frame.io, Google Drive, and Slack cards are removed until their services exist.

### Clipping wizard

The source step keeps YouTube connection secondary to the primary clipping action:

- The YouTube URL field and `Retrieve details` action remain at the top.
- Metadata retrieval works without a connected channel.
- A compact `Connect YouTube for automation` action appears below the metadata result, not between the source field and the primary Continue action.
- Copy explicitly says that connection is optional for clipping and required only for monitoring or publishing.
- The rights/source step requires an authorised media asset or validated direct-media URL before job submission.

The wizard never labels account connection as mandatory merely because a YouTube URL was entered.

### Automation rules

A connected user can create a rule for one channel with these settings:

- Enabled or paused.
- Trigger on newly uploaded channel videos.
- Default requested clip count and clip-duration preference.
- Default caption preset and content-type hint.
- Processing behavior:
  - `Create draft and request source` for external uploads.
  - `Start automatically when a matching Vidrial source exists`.
- Publishing behavior:
  - `Do not publish automatically` by default.
  - `Queue for review`.
  - `Schedule approved clips` at a chosen date and time.
- Default YouTube privacy: `private` by default, with `unlisted` and `public` available only when the Google project and user grants permit them.

Automatic public publishing is never silently enabled. The user must explicitly enable publishing, grant the upload scope, approve content and metadata, and choose a visibility.

### Publishing

Completed exports expose `Publish to YouTube` when a suitable connection exists. The publish form includes:

- Export/version selection.
- Title, description, tags, category, and audience declaration.
- Privacy status.
- Publish now or scheduled time.
- The destination channel.
- A final confirmation summarising what Vidrial will upload.

The result view shows queued, uploading, processing on YouTube, published, failed, cancelled, or reconnect-required states. Successful jobs link to the YouTube video.

## OAuth architecture

Vidrial uses the OAuth 2.0 web-server flow with PKCE, a short-lived state cookie, a short-lived PKCE verifier cookie, and an exact callback URI. The flow separates capabilities so users grant the narrowest required access:

- Channel connection requests `https://www.googleapis.com/auth/youtube.readonly`.
- Publishing is granted later through incremental authorization using `https://www.googleapis.com/auth/youtube.upload`.

Both flows request offline access when needed. The callback validates state, exchanges the code exactly once, validates returned scopes, loads the authenticated channel, and stores only encrypted access and refresh tokens. A missing refresh token during incremental authorization preserves the existing encrypted refresh token instead of overwriting it.

Token encryption uses authenticated AES-256-GCM with a versioned envelope. The encryption key remains server-only. Token refresh occurs behind a service interface with a per-connection lock so simultaneous worker tasks do not race. Invalid-grant and revoked-token responses mark the connection `reconnect_required` and stop dependent tasks without deleting the user's rules or history.

Disconnect revokes the Google token when possible, deletes encrypted tokens, disables active subscriptions and rules, and retains non-secret audit history.

The OAuth callback returns the user to the originating integrations, wizard, or publishing screen using a signed short-lived return-path value. Arbitrary external redirects are rejected.

## Data model

The existing `oauth_connections` table is extended rather than replaced. Its public RLS view exposes connection metadata but never encrypted tokens.

### `oauth_connections` additions

- `status`: `connected`, `reconnect_required`, `revoked`, or `error`.
- `capabilities`: text array containing `channel_read` and optionally `video_publish`.
- `token_version`: encryption envelope version.
- `last_refreshed_at`, `last_verified_at`, `last_error_code`.
- `disconnected_at`.

### `youtube_channels`

Stores the workspace connection's channel ID, title, avatar URL, uploads-playlist ID, and last observed activity. One connection can expose more than one selectable channel if Google returns multiple channels.

### `automation_rules`

Stores workspace, owner, provider, channel, enabled state, trigger, source behavior, clipping defaults, publishing defaults, timezone, and timestamps. Enabling automatic processing records a versioned standing rights statement, policy version, acceptance time, and accepting user for that connected channel. Each automatically created clip job still receives its own immutable rights-attestation row derived from that record. RLS limits access to workspace members; mutations require workspace owner/editor privileges.

### `youtube_subscriptions`

Stores channel, callback identity, hub topic, lease expiry, last renewal attempt, status, and verification state. Secrets used to authenticate callbacks are hashed, not stored in plaintext.

### `automation_events`

Stores a unique provider event key, channel/video IDs, event kind, received time, sanitized payload metadata, processing status, and associated rule/draft/job. A unique constraint makes webhook delivery idempotent.

### `automation_drafts`

Represents a detected upload awaiting a source or approval. It stores official video metadata, proposed clipping settings, source-match state, and the eventual clip-job ID.

### `publishing_jobs`

Stores export/version, destination channel, title/description/tags/category/audience, privacy, scheduled time, status, idempotency key, resumable-session metadata, provider video ID/URL, attempt count, and safe error details.

Sensitive OAuth tokens remain accessible only to trusted server and worker code. Publishing metadata and state use workspace RLS. Service-role operations validate workspace and connection ownership before acting.

## Notification and automation flow

1. Enabling a channel rule creates or renews a subscription with YouTube's official WebSub hub.
2. YouTube verifies the HTTPS callback challenge. Vidrial validates the topic and expected subscription before responding.
3. Notification POSTs are size-limited, parsed as XML without external entities, normalized, and deduplicated by channel/video/event identity.
4. Vidrial retrieves current official video metadata to distinguish new uploads from title/description updates.
5. Matching enabled rules create or update an automation draft.
6. If a matching authorised source asset exists, Vidrial submits the standard transactional clipping-job RPC, materializes a job-specific rights attestation from the enabled rule's versioned standing acceptance, and wakes the worker. A source matches only through an explicit provider-video-ID mapping recorded by a Vidrial upload/publish flow or a user attachment to the draft; titles, filenames, durations, and thumbnails are never used as proof of a match.
7. Otherwise, the draft remains `awaiting_source` and the UI requests the original media.
8. Subscription leases are renewed by a scheduled database task before expiry. Failures use bounded retries and surface an integration warning.

Webhook receipt does not perform FFmpeg or provider work inline. It only validates, records, and enqueues durable work.

## Publishing flow

1. The user selects a completed export and confirms YouTube metadata, audience, privacy, and timing.
2. The server verifies workspace access, export readiness, connection capability, scheduled time, and idempotency.
3. A `publishing_jobs` row and outbox event are created transactionally.
4. The worker refreshes the OAuth token when necessary and starts a resumable `videos.insert` upload.
5. The resumable session URL is encrypted or stored only in trusted task state. Retries resume the session where possible rather than creating duplicate videos.
6. After upload, the worker polls the video's YouTube processing state with bounded backoff.
7. Success stores the provider video ID and URL and emits an audit event. Permanent API, policy, quota, audience, or token failures surface a specific recovery action.

Scheduled publishing uses the existing Postgres-backed queue and cron wake mechanism. A scheduler promotes due jobs into the queue. Times are stored in UTC and displayed in the user's selected timezone.

## Provider boundaries

YouTube operations live behind typed interfaces:

- `YouTubeOAuthProvider`
- `YouTubeChannelProvider`
- `YouTubeSubscriptionProvider`
- `YouTubePublishingProvider`

Route components call server services and never handle tokens. Provider responses are schema-validated. Logs redact authorization headers, access tokens, refresh tokens, OAuth codes, PKCE verifiers, webhook secrets, and resumable upload URLs.

Future TikTok and Instagram implementations can satisfy the same connection, automation-event, and publishing-job contracts without changing the clip-processing domain.

## Logos and attribution

YouTube artwork is sourced from YouTube's official brand resources and used without modification. It appears only for YouTube-specific features and links to the connected channel or YouTube integration area. TikTok and Instagram use maintained Simple Icons components through a React icon library until official provider integrations require different assets.

No logo is drawn, approximated, color-shifted, or combined with the Vidrial wordmark. Asset source and license notes are recorded in the repository documentation.

## Error handling

User-facing errors always provide a recovery action:

- OAuth state or code failure: restart the connection.
- Missing scope: grant publishing access.
- Revoked or expired refresh token: reconnect YouTube.
- Channel unavailable: choose another channel or reconnect.
- Subscription expired: renew now; scheduled renewal retries automatically.
- External upload without source: attach the original media.
- YouTube quota exhausted: retry after the provider reset time.
- Upload interrupted: resume the existing publishing job.
- YouTube processing failed: inspect the provider reason and retry with a compatible export.
- Scheduled time missed during downtime: require review before publishing rather than silently publishing late.

No raw provider response or secret is sent to the browser.

## Security and compliance

- Use least-privilege incremental scopes.
- Verify OAuth state and PKCE and allow only same-origin return paths.
- Encrypt tokens and resumable upload session data at rest.
- Use constant-time comparisons for callback secrets.
- Reject oversized webhook bodies and unsafe XML constructs.
- Make webhook, automation, and publishing operations idempotent.
- Keep source rights attestation mandatory for every clipping job.
- Never fetch media from YouTube watch or playback URLs.
- Add Google-data use, storage, revocation, and deletion disclosures to the privacy policy.
- Provide a visible disconnect and data-deletion path.
- Keep the app in a test-user-safe mode until Google OAuth brand/scope verification and YouTube API compliance review are complete.
- Treat private as the default upload visibility. Unverified Google API projects may be unable to publish non-private videos.

## Free-first deployment

The design reuses the existing Vercel application, Supabase database/cron, and Render FFmpeg worker. Webhook receipt and scheduler scans are lightweight. Media publishing uses the existing worker so Vercel functions do not stream large video files.

No paid social aggregator is introduced. The design respects YouTube API quota limits, uses push notifications instead of wasteful polling, and performs metadata reads only when necessary. Free-tier cold starts may delay automation and scheduled work; the UI reports queued state accurately and does not promise exact-to-the-second publishing.

## Testing

### Unit tests

- OAuth state, PKCE, incremental-scope, token-envelope, and return-path validation.
- Refresh-token preservation and reconnect-required transitions.
- WebSub challenge validation, safe XML parsing, deduplication, and update-vs-upload classification.
- Automation rule validation, source matching, timezone conversion, and due-job selection.
- Publishing metadata, audience, privacy, and idempotency validation.
- Provider error classification and redaction.

### Component tests

- Integrations page disconnected, connected, reconnect-required, capability, and coming-soon states.
- Connect, grant publishing, pause automation, and disconnect confirmations.
- Wizard copy and layout prove that connection is optional for clipping.
- External-upload draft requests a source file.
- Publishing form and scheduled-time validation.

### Integration tests

- RLS isolation for connections, channels, rules, drafts, events, and publishing jobs.
- OAuth callback upsert without exposing encrypted tokens.
- Idempotent webhook delivery and transactional automation-draft creation.
- Matching Vidrial source starts exactly one clipping job.
- Due publishing job creates exactly one worker task.
- Disconnect disables rules and prevents future provider work.

### Worker tests

- Mocked resumable YouTube upload initiation, continuation, transient retry, completion, and duplicate prevention.
- Token refresh concurrency and revoked-token failure.
- YouTube processing-status polling and timeout handling.
- Logging assertions confirm secret redaction.

### Browser and live verification

- Connect a configured Google test user and return to the initiating screen.
- Confirm channel data and correct integration status.
- Clip from an uploaded authorised fixture without connecting YouTube.
- Receive a signed test notification and create an awaiting-source draft.
- Publish a tiny licensed fixture privately to the connected test channel, then verify the returned YouTube video ID and processing state.
- Disconnect and confirm that protected actions require reconnection.
- Scan Vercel and worker logs for errors and secret leakage.

Real provider verification is reported separately from mocked tests. Public/unlisted publishing is not claimed until Google's project verification and API audit permit it.

## Deployment and migration sequence

1. Add schema, RLS, indexes, RPCs, scheduled renewal, and publishing-queue migrations.
2. Add OAuth encryption/decryption, PKCE, refresh, revoke, and capability services.
3. Add channel, subscription, webhook, automation-draft, and publishing services.
4. Add worker publishing handlers and tests.
5. Replace the integrations placeholder UI and adjust the clipping wizard connection placement/copy.
6. Add privacy and integration documentation.
7. Configure Google callback URLs, scopes, test users, webhook URL, and production secrets without committing them.
8. Apply Supabase migrations, deploy Render and Vercel, and run live verification with a licensed fixture.

## Acceptance criteria

- Manual clipping works without a connected YouTube account when an authorised source is supplied.
- A YouTube URL alone never becomes a downloadable processing source.
- The YouTube card uses approved branding and accurately reflects live connection state.
- TikTok and Instagram are visibly upcoming and have no fake Connect actions.
- OAuth state, PKCE, encryption, refresh, revocation, capability grants, and safe redirects are tested.
- Connected channels can enable official upload notifications.
- External channel uploads create idempotent drafts that request source media.
- Existing authorised assets can start an automated clipping job exactly once.
- Completed exports can be queued, scheduled, uploaded resumably, and tracked on YouTube.
- Publishing defaults to private and requires explicit user confirmation.
- All schema changes have RLS and all secrets remain server/worker-only.
- Type checking, linting, unit, component, integration, worker, browser, and production-build checks pass.
- The final deployment is verified on Vercel, Supabase, Render, and a Google test channel without leaking credentials.

## Official references

- [YouTube OAuth for web-server applications](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps)
- [YouTube push notifications](https://developers.google.com/youtube/v3/guides/push_notifications)
- [YouTube resumable uploads](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol)
- [YouTube `videos.insert`](https://developers.google.com/youtube/v3/docs/videos/insert)
- [YouTube API branding guidelines](https://developers.google.com/youtube/terms/branding-guidelines)
- [Google OAuth sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
