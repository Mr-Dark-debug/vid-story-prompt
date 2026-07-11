# ADR 0001: External video worker

Status: accepted.

Video processing runs in a Docker-compatible external worker, not Supabase Edge Functions. FFmpeg workloads need long execution time, native binaries, substantial CPU/RAM, isolated temporary disk, subprocess cancellation and provider-aware concurrency. Edge Functions are appropriate for short request orchestration but not durable multi-stage media rendering.

PostgreSQL/Supabase remains provider-neutral system state. A leased task interface and private Storage allow the container to run on Railway, Render, Fly.io, Cloud Run or another host without changing the domain model. The trade-off is a separately deployed service and explicit operations/health monitoring, accepted in exchange for reliable media processing and portable scaling.
