# Connector automations

Automations observe an authorised provider collection and create a draft or clipping job when a new source appears. They never bypass rights confirmation, plan limits, source validation, or publishing review.

## Current support

YouTube channel upload automation is the only executable trigger in this release. It uses official channel metadata and webhook subscription behavior already documented in `docs/YOUTUBE_CLIPPER.md`. Because YouTube does not provide the source media, a detected upload remains an `awaiting_source` draft until an authorised original is attached or a matching Vidrial-published asset is found.

Drive folder items, cloud recordings, recording exports, RSS episodes, and S3 prefixes are represented in the automation directory and schema but remain Coming soon until their polling/webhook runners and end-to-end provider verification ship. Their forms do not create a fake enabled rule.

## Rule contract

Rules store connector and connection identity, remote collection identity, duration bounds, aspect ratio, brand preset, language, excluded keywords, clip count, publishing destinations, approval mode, timezone, monthly ceiling, rights-policy version, and connector-specific trigger configuration.

`automation_source_runs` deduplicates observations on `(automation_rule_id, remote_asset_id, remote_version_id)`. That key prevents webhook replay and polling overlap from creating duplicate imports. The plan trigger enforces the workspace's maximum rule count even for service-role writes.

## Safety and publishing

- A trigger only schedules work; the import worker independently validates media and the clipping service independently reserves usage.
- Automatic publishing is not implied by automatic clipping. Publishing destinations have separate connections and entitlement checks.
- YouTube publication uses only official upload APIs and defaults to review-safe settings.
- Rules stop creating work when disabled, over their monthly ceiling, disconnected, or awaiting rights/source evidence.
- Provider event payloads are untrusted input and are reduced to validated identifiers and metadata before persistence.

## Operating the system

Inspect `automation_rules`, `automation_source_runs`, provider subscription health, and linked connector imports when a rule stalls. Replaying an observation with the same provider version is safe because the deduplication constraint is authoritative. Do not delete deduplication rows merely to retry a failed import; retry the linked task or create a deliberate new remote version.
