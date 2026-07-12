# Free Video Worker and Turnstile Design

## Objective

Run Vidrial's existing FFmpeg video worker at zero platform cost during the initial launch, wake it only when work exists, protect public YouTube metadata requests with Cloudflare Turnstile, and preserve a straightforward migration path to paid container infrastructure.

## Constraints

- The hosting configuration must select a provider's explicitly free instance type and must not enable usage-based paid compute.
- Provider, database, wake, and Turnstile secrets must remain server-side and outside Git.
- The existing Supabase queue remains the system of record. Worker restarts, cold starts, and temporary shutdowns must not lose jobs.
- The free worker has limited CPU, memory, ephemeral disk, and cold starts. The UI and job state must report this honestly.
- Only media for which the user completed the existing rights confirmation may enter the processing queue.

## Selected Architecture

### Render free worker

Deploy `services/video-worker/Dockerfile` as a Render Web Service on the Free instance type. The image already installs FFmpeg and ffprobe. It listens on Render's `PORT`, exposes health/readiness endpoints, and polls the Supabase task queue while running.

The service uses one worker process, conservative FFmpeg concurrency, bounded temporary storage, and the existing task lease/heartbeat model. Generated artifacts are uploaded to Supabase Storage; local files are temporary and may be discarded safely after completion or restart.

Render configuration is captured in `render.yaml`. Secrets are declared with `sync: false`, so values are entered in Render rather than committed. Automatic deployment follows the repository's `main` branch.

### Workload-aware wake-up

Add an authenticated worker wake endpoint using a long random bearer secret. The application calls this endpoint after successfully creating a clip job. Wake failures do not invalidate the queued job; they produce an observable warning and the fallback scheduler can recover it.

Add a Supabase Cron fallback that checks for queued, leased, or running clip tasks. It sends a wake request only while work exists. Idle periods produce no external request, allowing the Render service to sleep instead of using free instance hours solely as a keep-alive.

Once awake, the worker continues polling until Render idles it. Active jobs are protected by existing leases and periodic heartbeats. If the instance stops, expired leases make unfinished work reclaimable.

### Cloudflare Turnstile

Create one free managed Turnstile widget for:

- `vid-story-prompt.vercel.app`
- the stable Vercel production alias used by the project
- `localhost` for development

Add the public site key to the application's public runtime configuration and the secret key only to Vercel's protected production environment. Render does not need the Turnstile secret.

The YouTube metadata form renders the accessible Turnstile widget, obtains a short-lived token, and submits it with the metadata request. The existing server verifier validates the token with Cloudflare. Missing, expired, duplicate, or rejected tokens return a recoverable message and reset the widget.

Turnstile protects public metadata requests only in this scope. Supabase login/signup CAPTCHA enforcement is not enabled yet because that requires a separate auth-form integration and recovery-flow testing.

## Configuration Boundaries

### Render secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY` when configured
- `OPENAI_API_KEY` when configured
- `OPENROUTER_API_KEY`
- `OPENROUTER_CLIP_MODEL`
- `WORKER_WAKE_SECRET`

Non-secret worker settings include model names, queue timing, single-worker concurrency, disk limits, and log level.

### Vercel variables

- `VIDEO_WORKER_URL`
- `WORKER_WAKE_SECRET`
- `VITE_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

The application never exposes the wake secret, Turnstile secret, Supabase service-role key, or AI-provider keys to browser bundles.

### Supabase configuration

A versioned migration enables the required scheduling/network extensions when available, defines a narrowly scoped workload check, and installs the wake schedule. The wake URL and secret are stored using Supabase Vault rather than literal SQL migration values. If project-level Vault/Cron configuration cannot be completed safely through migration alone, those values are set through the authenticated dashboard and documented without recording them in Git.

## Failure Handling

- A sleeping worker may take about one minute to start. The job remains queued and the UI reports that the free worker is starting.
- Wake request failure leaves the task queued and records a warning without deleting or duplicating the job.
- Worker interruption relies on task lease expiry and idempotency keys for safe retry.
- FFmpeg out-of-memory, disk-limit, unsupported-codec, provider, and download failures retain their existing structured error codes and recovery actions.
- Turnstile failures are user-retryable and never silently bypass verification when the production secret is configured.
- Health endpoints disclose status and worker identity only; they do not expose configuration, task payloads, media URLs, or secrets.

## Verification

1. Build the Docker image and verify FFmpeg/ffprobe inside it.
2. Run worker unit tests plus health, readiness, wake-authentication, shutdown, and queue-recovery tests.
3. Run application typecheck, lint, unit tests, build, and Playwright tests.
4. Verify the Render service reports healthy and includes FFmpeg availability.
5. Create a controlled queue job and verify wake, claim, heartbeat, completion/failure state, and temporary-file cleanup.
6. Verify the production Turnstile challenge, successful metadata request, rejected-token behavior, and widget reset.
7. Confirm browser console cleanliness and verify that no protected value appears in HTML, JavaScript assets, logs, or Git.

## Free-Tier Limits and Upgrade Path

The Render Free service may sleep after inactivity, cold-start slowly, restart without notice, and provide insufficient resources for large or high-resolution video. Vidrial will initially restrict workload expectations rather than hide these limits.

The worker remains a portable Docker image. A later upgrade can select a paid Render instance or migrate the same image to Cloud Run or another container platform. Supabase queue contracts, task leases, storage, and application wake semantics remain unchanged.

