# Python YouTube Acquisition Design

**Status:** Approved for implementation by the user on 2026-07-30.

## Problem

The existing “Continue on this device” recovery asks a customer to install and run a local CLI. That is not a dependable product path and must disappear from the UI and active acquisition planner. Vidrial also needs a clearly bounded Python acquisition engine without undoing the production-proven WARP egress, job queue, rights checks, storage controls, or plan enforcement.

## Hosting decision

Three designs were evaluated:

1. **A Python Vercel Function.** Rejected. Vercel supports Python and FastAPI, but Functions remain bounded invocations and currently limit request and response bodies to 4.5 MB. Returning source video bytes through a Function is therefore unsuitable. It also does not change the datacenter egress characteristic that caused the original YouTube failures.
2. **A second free Render web service.** Rejected as the default. Render free web services spin down after 15 minutes, cannot receive private-network traffic, and may be suspended for unusually high outbound transfer. A second service would add another cold start and failure boundary without improving egress.
3. **A loopback-only FastAPI engine in the existing worker container.** Selected. It reuses the working WARP pool, FFmpeg runtime, task lease, heartbeat, cancellation, Supabase uploader, and wake endpoint. It adds no paid dependency and no second sleeping service.

The Python service is an internal execution engine, not a public “download any URL” API. It binds to `127.0.0.1`, requires a per-container bearer token, accepts only canonical YouTube video IDs, and writes only under the worker’s isolated temporary root.

## Architecture

The TanStack application continues to create a rights-attested clipping job through server-side Supabase functions. The Node worker remains the durable coordinator and independently loads the active plan. It derives the maximum acquisition height from `plans.max_export_height`; browser input can never raise this cap.

For each persisted acquisition tier, the Node worker submits an asynchronous request to FastAPI and receives HTTP 202. FastAPI embeds the pinned `yt-dlp` Python package, applies the selected player strategy, WARP/operator proxy, maximum height, file-size bound, non-live duration filter, and optional FFmpeg section range. Node polls the internal status endpoint while maintaining the existing Supabase task heartbeat. Cancellation calls the Python DELETE endpoint.

FastAPI sends signed, idempotent progress webhooks to the Node worker. Node maps states to fixed safe copy and stores them as `processing_events`. Supabase Realtime updates the job timeline and emits restrained toasts for acquisition start, completion, and actionable failure. The browser receives neither proxy URLs nor service credentials.

When Python completes, it returns JSON metadata and an absolute local filename inside the shared container—not the video body. Node validates path containment, size, and extension again, runs malware/media validation, uploads the immutable object to Supabase Storage, and attaches it to the job. The Python API supports a small output allowlist (`mp4`, `webm`, `mkv`), while Vidrial clipping always requests `mp4` for downstream compatibility.

## Acquisition and plan rules

- Free acquisition height is capped at 720p.
- Creator acquisition height is capped at 1080p.
- Pro acquisition height is capped at 2160p.
- The current active server-side plan is authoritative. Request payloads do not contain a trusted plan name.
- Public or unlisted, non-live, non-DRM media with a stored rights attestation is eligible.
- Private, age-restricted, region-restricted, paid, DRM, and unavailable media remain unsupported and receive specific errors.
- `YTDLP_PROXY_URL` retains highest precedence, followed by the healthy WARP pool. Production never silently falls back to direct egress.
- Partial source sections remain enabled through FFmpeg-backed yt-dlp download ranges.

## Local relay retirement

The local relay component, pairing API route, application service, helper package, helper scripts, runtime settings, and relay-specific global toast subscriptions are removed. Historical database migrations and generated database types remain because applied migrations are immutable production history. The acquisition planner no longer emits `local_relay`; existing historical job status values remain readable so old records do not break.

If cloud acquisition is exhausted, the only recovery UI is an authorised original upload, owner-controlled direct media URL, or connected cloud-storage source. Copy no longer recommends a local helper.

## Security invariants

- FastAPI listens only on loopback and uses constant-time bearer-token comparison.
- The internal token and webhook signing secret are generated per container when absent and never logged.
- Webhook signatures cover the exact raw body; bodies are size bounded; event schemas and state names are allowlisted.
- Webhook persistence is idempotent through a unique provider event ID.
- Output directories and returned filenames must resolve beneath `WORKER_TEMP_ROOT`.
- Proxy credentials, private source URLs, tokens, filenames, and yt-dlp diagnostic text never enter browser payloads or product analytics.
- The Python process runs as the existing unprivileged `node` container user.
- Downloads retain timeout, maximum-byte, no-playlist, IPv4, retry, and cancellation controls.

## UI direction

The recovery surface follows Vidrial’s calm editorial system: one concise warning panel, a clear “Use your original source” heading, and responsive source choices. Removing the large relay card restores hierarchy and reduces cognitive load. Status remains visible through the existing egress badge and event timeline. Acquisition toasts are short and state-based, not noisy progress-percentage notifications. Layout must have no horizontal overflow at 360 px.

## Verification

- Python unit tests cover auth, validation, plan height formatting, section ranges, cancellation, output containment, idempotent request IDs, and error classification.
- Worker tests cover the Python client, signed webhook verification, plan-derived height, proxy selection, and no local-relay planning.
- App tests confirm relay copy/actions are absent and recovery remains usable.
- Typecheck, lint, app tests, worker tests/build, Python tests, and app build pass.
- Browser verification covers desktop and 360 px mobile recovery/status UI.
- Production verification requires a healthy FastAPI readiness check plus a real rights-attested YouTube clip reaching `ready`, with Python/WARP/section events and a downloadable preview.

## Research basis

- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- [Vercel Python runtime](https://vercel.com/docs/functions/runtimes/python)
- [Render free-service limits](https://render.com/docs/free)
- [FastAPI background tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [FastAPI containers](https://fastapi.tiangolo.com/deployment/docker/)
- [yt-dlp embedding guide](https://github.com/yt-dlp/yt-dlp/blob/master/README.md#embedding-yt-dlp)
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)

## Residual risks

YouTube may later block Cloudflare WARP; `YTDLP_PROXY_URL` remains the operator escape hatch. Free Render still has cold starts and outbound-traffic limits, so a paid always-on worker is required for a formal uptime guarantee. WARP does not and must not bypass region, age, account, paid, or DRM restrictions.
