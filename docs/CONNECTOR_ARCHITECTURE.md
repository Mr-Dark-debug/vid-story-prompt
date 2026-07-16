# Connector architecture

Vidrial connectors are an authorised-source layer around the existing clipping pipeline. They do not replace clipping jobs, usage reservations, FFmpeg validation, transcription, planning, rendering, or immutable storage.

## Sources of truth

- `src/domain/connectors/registry.ts` is the server-owned product directory. It defines labels, categories, availability, authentication modes, capabilities, rights requirements, public-link support, and feature flags.
- `connector_definitions` mirrors executable server configuration in PostgreSQL. Runtime catalog responses combine the static definition with credential configuration and the current workspace's connection state.
- `src/domain/clipping/types.ts` remains authoritative for clipping job status. `src/domain/clipping/entitlements.ts` and matching plan rows remain authoritative for limits.
- Publishing connectors are intentionally separate in `src/domain/connectors/publishing.ts` because importing a source never implies permission to publish it.

## Request and import flow

1. The browser selects a connector from the searchable, grouped source picker.
2. Public URL detection identifies a likely source without fetching it. The selected panel then gathers only the fields that connector needs.
3. OAuth connectors start a server-generated PKCE transaction. Tokens are encrypted and persisted server-side; only a token-free connection summary may reach the browser.
4. Browse requests execute on the server against official provider APIs. Returned assets are validated into the common `RemoteMediaAsset` shape.
5. Selection creates one idempotent `connector_imports` row and one leased `connector_tasks` row. Browsing does not consume clipping usage.
6. The Docker worker retrieves the encrypted token, streams the selected asset into an isolated temporary directory, enforces limits, optionally scans it with ClamAV, validates it with FFprobe, hashes it, and uploads an immutable private object.
7. Only a ready `media_assets` record can be attached to a clipping job. `source_attachments` records connector provenance separately from the primary media asset.
8. Existing job queue handlers perform transcription, planning, previews, captions, watermarking, and final exports.

## Execution boundaries

Browser code uses the publishable Supabase key only. OAuth credentials, provider tokens, service-role access, remote provider requests, direct downloads, DNS checks, malware scanning, FFmpeg, and signed storage operations stay in server or worker code.

YouTube supports metadata, embed, connected-channel, automation, publishing, and a server-only acquisition path. A clipping job created from an eligible public or unlisted URL queues the isolated worker only after versioned rights confirmation and plan enforcement. yt-dlp never enters browser code and cannot receive cookies, proxy settings, provider credentials, or arbitrary arguments from a request.

## Availability semantics

- **Available** means the repository contains an executable path covered by automated tests.
- **Beta** means the UI and contracts are present, but execution is enabled only where a real official adapter and required environment configuration exist. The UI never simulates a connection.
- **Coming soon** means selection is disabled for execution. The user can record interest without an OAuth popup.
- **Configured** is a runtime property and never inferred from a client flag alone.

## Failure and idempotency model

Connector tasks are claimed with leases, started explicitly, heartbeated with byte progress, and completed only by the lease owner. Failures are classified as retryable or terminal and eventually dead-lettered. The unique workspace/idempotency key prevents duplicate imports, while an immutable destination check prevents duplicate asset attachment.

Cancellation marks the import terminal and prevents queued tasks from starting again. A task already streaming polls cancellation and rechecks the import before durable upload and finalization; temporary content is removed in all exit paths.

## Extending the directory

Adding a directory entry is not sufficient to make a connector executable. A production connector also needs an official provider adapter, server credential configuration, token/revocation behavior, worker transfer support, entitlement policy, tests, documentation, and an explicit availability update.
