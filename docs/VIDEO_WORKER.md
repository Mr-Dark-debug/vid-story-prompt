# Video worker

`services/video-worker` is a Node.js 22 Docker service with FFmpeg, FFprobe and licensed Liberation fonts. It claims one leased task per container, heartbeats, honours cancellation and cleans its isolated temporary directory in `finally`.

Implemented handlers validate media, securely download direct sources, build proxies, extract/chunk audio, transcribe with Groq/OpenAI fallback, merge overlap words, plan candidates through OpenRouter, deduplicate/select diverse moments, render previews/final exports, create SRT/VTT/ASS and delete expired assets.

Use at least 4 vCPU, 8 GB RAM and 20 GB temporary disk per render container. Horizontal scaling is safe because database leases and idempotency keys are authoritative.
