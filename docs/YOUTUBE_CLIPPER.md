# YouTube Clipper

The authenticated three-step wizard accepts a YouTube URL, retrieves official metadata with `YOUTUBE_API_KEY`, shows a privacy-enhanced embed, records the exact versioned rights confirmation, reserves plan usage, and creates the clipping job transactionally. A local upload is not required for an eligible public or unlisted YouTube video.

When the job has no attached source asset, PostgreSQL queues `download_youtube_source`. The Docker worker independently verifies the rights-attestation row and active plan limit, then starts its pinned yt-dlp binary with a fixed argument array and explicitly enables the image's Node 22 runtime for the bundled YouTube challenge solver. Cloud cookie uploads, browser credentials, arbitrary user arguments, playlists, live video, excessive duration, excessive size, and unbounded retries are not allowed. Protected egress rotation is bounded to measured, unique WARP identities; optional cookie use remains local to an explicitly paired helper. The downloaded file stays in the isolated task directory until virus scanning and FFprobe validation complete; it is then hashed, stored in the private source bucket under the immutable workspace path convention, attached to the job, and passed to the existing validation/transcription/planning/rendering pipeline.

Acquisition is cancellation-aware, retry classified, and proxy-tier audited. A configured operator proxy has priority, followed by explicit/Render WARP egress; direct production egress is marked degraded. Invalid, private, sign-in-required, age-restricted, region-restricted, live, oversized, and unavailable sources produce distinct user-facing guidance. WARP is an egress path, not an account, age, region, rights, or availability bypass.

When automatic acquisition is exhausted, the job enters `awaiting_authorised_source` instead of becoming a dead new-job flow. Its YouTube metadata, settings, rights record, usage reservation, completed work, and events remain on the same job. The user can upload the original, import it from connected storage, or attach an owner-controlled HTTPS media URL. The transactional attachment RPC verifies job/workspace ownership, validates asset provenance, supersedes the failed acquisition task without deleting it, queues source validation, and is idempotent. FFprobe performs the authoritative duration/stream comparison; a material mismatch requires confirmation and usage is not charged twice.

Unknown yt-dlp stderr, source URLs, output filenames, tokens, cookies, and proxy credentials are not persisted in browser-visible events. Automated tests verify command construction and queue orchestration; a live provider download still requires the deployed worker, current pinned binary, working approved egress, and a source the operator is authorised to process.

Optional Google channel automation and publishing require `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY`, and `YOUTUBE_WEBHOOK_SECRET`. OAuth uses incremental scopes: channel connection requests read-only access, while publishing requests `youtube.upload` only after the user enables it. YouTube OAuth does **not** authenticate yt-dlp downloads; the connector dialog separates account tools from URL clipping explicitly. Tokens and resumable upload sessions remain encrypted, WebSub callbacks are signed and idempotent, and disconnecting revokes tokens and disables subscriptions.

Completed exports can be uploaded through the external worker with YouTube's official resumable upload protocol. Publishing defaults to private and records scheduled, uploading, processing, published, reconnect-required, cancelled, or failed state in Supabase.

## URL clipping, account connection, and recovery

`Connect YouTube account` is optional YouTube Data API access for authorised channels, uploads, playlists, automation, and publishing. It does not authenticate or repair media downloads. `Clip a YouTube URL` accepts eligible public or unlisted URLs without an account connection and shows the worker's sanitized egress status.

If every cloud source path is challenged, the job becomes action-required without losing its ID, metadata, rights attestation, clip settings, usage reservation, completed artifacts, or event history. The recovery panel offers:

- **Continue on this device** through the free paired helper. Acquisition and upload continue asynchronously; Supabase Realtime events produce deduplicated navigation-safe toasts for queued, uploading, completed, and failed boundaries.
- **Upload original** or select an authorised source through an existing connected Drive, Dropbox, or OneDrive connector.
- **Owner-controlled media URL** through the existing SSRF-protected server path.

Pairing tokens expire after ten minutes and are single-use. Device credentials are stored only as hashes server-side and can be revoked. Each job capability is signed, expires after two hours, and is restricted to one video ID, exact clip section, immutable Storage path, and maximum byte count. The helper never receives a Supabase service key.

The helper is cookie-free by default. Optional cookies are read only from an explicit local path, never uploaded, and accompanied by a warning that they are full account-session credentials and can cause restrictions. Vidrial does not use account cookies to bypass private, paid, DRM, age, or region restrictions.
