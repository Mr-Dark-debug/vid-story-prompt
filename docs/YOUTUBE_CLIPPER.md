# YouTube Clipper

The authenticated three-step wizard accepts a YouTube URL, retrieves official metadata with `YOUTUBE_API_KEY`, shows a privacy-enhanced embed, records the exact versioned rights confirmation, reserves plan usage, and creates the clipping job transactionally. A local upload is not required for an eligible public or unlisted YouTube video.

When the job has no attached source asset, PostgreSQL queues `download_youtube_source`. Capability-aware leasing sends that task to an acquisition-capable worker while Render remains available for validation, transcription, planning, rendering, and export. The acquisition worker independently verifies the rights-attestation row and current active plan, derives the 720p/1080p/2160p cap, and submits an asynchronous request to its loopback-only Python FastAPI engine. The engine embeds yt-dlp 2026.08.19, its matching EJS package, and Node 22. Cloud cookie uploads, browser credentials, arbitrary user arguments, playlists, live video, excessive duration, excessive size, and unbounded retries are not allowed. The downloaded file stays in the isolated task directory until Node repeats path/size checks, virus scanning, and FFprobe validation; it is then hashed, stored in the private source bucket under the immutable workspace path convention, attached to the job, and passed to the existing downstream pipeline.

Acquisition is cancellation-aware, retry classified, and source-tier audited. A configured operator proxy has priority, followed by explicit/Render WARP egress; the installed home worker may use its verified residential route. Invalid, private, sign-in-required, age-restricted, region-restricted, live, oversized, and unavailable sources produce distinct user-facing guidance. WARP or residential egress is not an account, age, region, rights, or availability bypass.

When automatic acquisition is exhausted, the job enters `awaiting_authorised_source` instead of becoming a dead new-job flow. Its YouTube metadata, settings, rights record, usage reservation, completed work, and events remain on the same job. The user can upload the original, import it from connected storage, or attach an owner-controlled HTTPS media URL. The transactional attachment RPC verifies job/workspace ownership, validates asset provenance, supersedes the failed acquisition task without deleting it, queues source validation, and is idempotent. FFprobe performs the authoritative duration/stream comparison; a material mismatch requires confirmation and usage is not charged twice.

Unknown yt-dlp diagnostics, source URLs, output filenames, tokens, cookies, and proxy credentials are not persisted in browser-visible events. Signed Python callbacks are converted to fixed event copy and made idempotent before Supabase Realtime drives the job timeline and acquisition toasts. Automated tests verify the REST contract and queue orchestration; a live provider download still requires the deployed worker, current pinned package, working approved egress, and a source the operator is authorised to process.

Optional Google channel automation and publishing require `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY`, and `YOUTUBE_WEBHOOK_SECRET`. OAuth uses incremental scopes: channel connection requests read-only access, while publishing requests `youtube.upload` only after the user enables it. YouTube OAuth does **not** authenticate yt-dlp downloads; the connector dialog separates account tools from URL clipping explicitly. Tokens and resumable upload sessions remain encrypted, WebSub callbacks are signed and idempotent, and disconnecting revokes tokens and disables subscriptions.

Completed exports can be uploaded through the external worker with YouTube's official resumable upload protocol. Publishing defaults to private and records scheduled, uploading, processing, published, reconnect-required, cancelled, or failed state in Supabase.

## URL clipping, account connection, and recovery

As of September 2026 Vidrial is clipping-only. Standalone project/editor/template routes redirect to the clipping workspace; saved records are not deleted. Clip settings retain captions, boundaries, framing and export controls without a timeline. Marketing and pricing describe clipping entitlements rather than general video editing or generated-media credits. Paid upgrade interest is not a purchase or an activated subscription.

The progress summary groups actual tasks into Import, Understand, Create and Ready. Realtime updates are backed by active-job polling, and completion/failure notifications are deduplicated per browser session. Google OAuth app publication and verification remain operator requirements: External/Testing restricts who can connect and cannot be fixed by a browser retry.

`Connect YouTube account` is optional YouTube Data API access for authorised channels, uploads, playlists, automation, and publishing. It does not authenticate or repair media downloads. `Clip a YouTube URL` accepts eligible public or unlisted URLs without an account connection and shows the worker's sanitized egress status.

If every cloud source path is challenged, the job becomes action-required without losing its ID, metadata, rights attestation, clip settings, usage reservation, completed artifacts, or event history. The recovery panel offers:

- **Upload original** or select an authorised source through an existing connected Drive, Dropbox, or OneDrive connector.
- **Owner-controlled media URL** through the existing SSRF-protected server path.

The retired local-device relay is not offered in the product. Historical relay rows remain for migration compatibility only. Vidrial does not accept account cookies or try to bypass private, paid, DRM, age, or region restrictions.
