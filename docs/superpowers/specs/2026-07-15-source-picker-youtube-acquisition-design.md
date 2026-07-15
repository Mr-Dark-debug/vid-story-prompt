# Source picker and YouTube acquisition design

## Goal

Make the first step of the three-step clipping wizard a scalable, registry-backed source experience. The source picker must be the only top-level selector, provider marks must make sources easy to scan, pasted URLs must resolve to the correct connector, and a rights-attested YouTube URL must be able to enter the existing worker pipeline without a browser upload.

## Scope

- Remove the four duplicated quick-action tiles above the source combobox.
- Keep `src/domain/connectors/registry.ts` as the only connector catalog.
- Render provider-specific marks from the installed `react-icons` package, with an explicit neutral fallback for services without a library mark.
- Keep desktop popover and mobile drawer behavior, search, grouping, recent sources, availability, connected state, empty results, and the source directory.
- Use the existing URL detector to identify known links without downloading them in the browser or metadata request.
- Add a server-created, worker-executed YouTube acquisition path for an explicitly rights-attested clipping job.
- Preserve local upload, controlled direct URL, RSS, and configured cloud imports.
- Keep beta, disabled, and coming-soon connectors honest; no fake OAuth, progress, or provider success.

## Architecture

### Connector presentation

`ConnectorIcon` will accept the connector id in addition to the registry icon category. A provider-mark map will translate known registry ids to tree-shakeable icons from `react-icons`. The registry remains concerned with product capabilities and status; visual components own presentation.

The `SourcePicker` will remove its `quickIds` list and render one full-width trigger. The trigger, grouped results, directory, selected-source header, and integrations screen will all pass the connector id to the same icon component.

### URL resolution

The source step will expose URL entry only in connector-specific panels. Known URLs are detected with `detectUrlSource` before any import. A detected connector can be selected from the registry, and the UI will explain whether it supports metadata, media import, authentication, or requires an original source. Detection never sends an arbitrary URL directly to FFmpeg.

### YouTube acquisition

The browser retrieves official metadata as it does today. After the user confirms rights and submits the job, the server stores the YouTube URL as job input and enqueues a dedicated acquisition task when no source asset is attached. The worker invokes a pinned `yt-dlp` binary with a fixed argument list, no shell interpolation, no cookies, no proxy rotation, no arbitrary user arguments, bounded duration/size/time, an isolated temporary directory, and cancellation support. The result is probed, uploaded to the private source bucket using the immutable workspace path convention, stored as a media asset, attached to the job, and passed into the existing validation/transcription/planning/rendering chain.

YouTube acquisition is server-only and gated by the existing explicit rights attestation. Metadata requests never download media. Failures are retry-classified and do not create duplicate usage charges or media assets.

### Existing connectors

Configured Google Drive, Dropbox, and OneDrive imports continue through connector import records and worker tasks. RSS and direct HTTPS media continue through the SSRF-protected downloader. Unconfigured beta connectors remain visible but non-executable. Coming-soon connectors continue to record waitlist interest only.

## Error handling

- Invalid or unsupported URLs stay in the selected panel with an actionable message.
- YouTube metadata and media-acquisition failures are distinct so users know whether the URL is invalid, unavailable, restricted, or failed during import.
- Worker acquisition uses bounded retries for transient network/provider failures and terminal failures for invalid, private, live, oversized, or unsupported media.
- Cancellation terminates the acquisition process and removes temporary files.
- No secrets, private URLs, filenames, transcript text, or model output enter product analytics.

## Testing

- Source picker renders no quick-action tile grid.
- Every registry entry renders a provider mark or intentional fallback.
- Search, grouping, recent sources, keyboard navigation, desktop popover, and mobile drawer remain covered.
- URL detection selects supported connectors without downloading.
- YouTube jobs without an uploaded asset enqueue acquisition before validation.
- Worker command construction rejects arbitrary arguments and preserves bounds.
- Acquisition is idempotent, cancellation-aware, cleanup-safe, and attaches one immutable media asset.
- Local upload, direct URL, RSS, cloud import, waitlist, typecheck, lint, unit tests, worker tests, production build, and relevant Playwright flows are re-run.

## Deployment and limitations

The worker image must contain the configured `yt-dlp` executable and FFmpeg/FFprobe. Live YouTube and OAuth provider verification requires deployment credentials and real provider accounts; automated tests will cover orchestration and boundaries without claiming live-provider success. Provider availability remains controlled by configuration and feature flags.
