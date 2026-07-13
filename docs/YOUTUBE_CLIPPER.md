# YouTube Clipper

The public page accepts a YouTube URL for official metadata. Processing requires authentication, the exact versioned rights confirmation and an authorised media source. The four-step wizard estimates source usage, shows plan-derived export/watermark/retention behavior and submits one transactional RPC.

Required public metadata configuration: `YOUTUBE_API_KEY`. Optional Google channel automation and publishing require `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY`, and `YOUTUBE_WEBHOOK_SECRET`. Google connection proves channel management only; it does not produce source media.

YouTube OAuth uses incremental permissions. Channel connection requests read-only access; publishing requests `youtube.upload` only when the user enables it. Tokens and resumable upload sessions are encrypted, WebSub callbacks are signed and idempotent, and disconnecting revokes tokens and disables subscriptions. External channel uploads create an awaiting-source draft. Automatic clipping starts only when an explicit YouTube-video-to-Vidrial-asset mapping and a versioned standing rights acceptance both exist.

Completed exports can be uploaded through the external worker with YouTube's resumable upload protocol. Publishing defaults to private and records scheduled, uploading, processing, published, reconnect-required, cancelled, or failed state in Supabase.

Recoverable UI states name a specific retry, resume, re-authenticate, replace-source or upgrade action. Progress reports uploaded bytes, successful transcript chunks and completed previews rather than invented percentages.
