# YouTube Clipper

The public page accepts a YouTube URL for official metadata. Processing requires authentication, the exact versioned rights confirmation and an authorised media source. The four-step wizard estimates source usage, shows plan-derived export/watermark/retention behavior and submits one transactional RPC.

Required public metadata configuration: `YOUTUBE_API_KEY`. Optional Google ownership verification requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and encrypted token storage. Google connection proves channel management only; it does not produce source media.

Recoverable UI states name a specific retry, resume, re-authenticate, replace-source or upgrade action. Progress reports uploaded bytes, successful transcript chunks and completed previews rather than invented percentages.
