# Research notes: Batch video clipping

Checked 2026-07-31. Backlog ID 59. Official architecture references cover queue load leveling, retry/backoff with jitter, cloud retry strategy, and safe logging. These support bounded concurrency, retry classification, and safe observability, not vendor-performance claims.

Original contribution: define five meanings of “batch,” require a manifest with item-level identity, and extend batching through preflight, queue, review, partial failure, and export.

Vidrial truth: multiple entitled clips per job and server-side batch export exist; queue handlers are leased/idempotent/cancellation-aware. YouTube triggering Available; recurring Drive/RSS/cloud/S3 runners Coming soon. No broad unattended multi-source promise.

Review entitlements and current export UI; validate product claims with tests before publication.

