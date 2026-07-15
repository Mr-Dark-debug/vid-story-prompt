# Import security

## Trust model

Remote media, metadata, filenames, URLs, RSS XML, captions, and transcripts are untrusted. They are data, never commands. Provider identifiers are selected through official APIs, and the worker determines every local path and immutable storage destination.

## Public URL controls

Direct media and RSS fetching require HTTPS. Before each connection and redirect, the server resolves the hostname and rejects loopback, link-local, private, carrier-grade NAT, reserved, multicast, and metadata-service address ranges. Fetches use bounded redirects, connection/read timeouts, size ceilings, streaming byte accounting, and MIME/media validation. The RSS parser is bounded to 2 MB and does not resolve XML entities.

Direct links must identify an owner-controlled media file. HLS playlists and arbitrary webpage extraction are not currently advertised as executable. YouTube stream URLs, signature deciphering, cookies, proxy rotation, and unofficial download tools are prohibited.

## OAuth provider controls

The browser receives normalized file metadata only. It never receives provider tokens or durable provider download URLs. The worker re-fetches the selected asset by provider-scoped identifier, checks the connection is active, decrypts the token only in memory, enforces response type and maximum bytes, and removes the temporary directory in `finally` handling.

## Media verification and storage

Where `CLAMAV_PATH` is configured, the worker scans each new upload/import before FFprobe and durable storage. `VIRUS_SCAN_REQUIRED=true` fails closed if the scanner is unavailable. Without a configured scanner, the result is explicitly recorded as `not_configured`; it is not described as scanned.

FFprobe must find a playable timed audio or video stream. Speech clipping additionally requires audio. Audio-only podcast episodes receive a deterministic server-rendered visual slate for proxies, previews, captions, watermarks, and MP4 exports. FFmpeg never receives model-generated command arguments.

Objects use immutable paths shaped as `{workspace_id}/{user_id}/{job_or_import_id}/{asset_type}/{uuid}.{extension}`. The worker computes SHA-256 before creating the ready asset record. Private buckets and workspace RLS protect source and output metadata; signed URLs are short-lived and server-generated.

## Queue behavior

Imports are idempotent per workspace. Tasks are leased, heartbeat byte progress, classify retryability, cap attempts, and dead-letter exhausted failures. Cancellation is terminal. Incomplete temporary files are deleted and never attached to a clipping job.

Cloud transfer retries currently restart a provider stream from byte zero after the task lease is retried. Durable cross-worker range resume is not claimed in the UI and remains follow-up work. Local device upload retains its existing TUS resumable path.

## Logging and privacy

Logs and analytics must not include secrets, access tokens, signed URLs, private source URLs, transcripts, or original filenames. Audit events use connector identifiers and coarse outcomes only. User-visible errors are sanitized and bounded before persistence.
