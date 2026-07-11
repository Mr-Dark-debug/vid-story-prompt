# Changelog

## 2026-07-11

- Added YouTube Clipper public and authenticated routes.
- Replaced simulated authentication with cookie-backed Supabase Auth.
- Added workspace schema, RLS, private buckets, usage ledger, rights records, queue/outbox and render/export persistence.
- Added resumable TUS upload, official YouTube metadata parsing, controlled direct-media download and a Docker FFmpeg worker.
- Added transcription/planning adapters, realtime progress, persisted clip versions, captions, server watermarking, retention and tests.
