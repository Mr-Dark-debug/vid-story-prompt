# Python YouTube Acquisition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the customer-operated local relay with a production-integrated, plan-capped Python yt-dlp REST engine inside the existing protected video-worker container.

**Architecture:** The existing Node worker remains the durable queue, authorization, storage, and retry coordinator. A loopback-only FastAPI process performs asynchronous yt-dlp downloads through the selected WARP/operator proxy, emits signed idempotent progress webhooks, and returns local artifact metadata; Node validates and uploads the artifact. Vercel remains the web application host and never proxies video bytes.

**Tech Stack:** Python 3.11, FastAPI, Uvicorn, yt-dlp, FFmpeg, Node 22, TypeScript, Supabase PostgreSQL/Storage/Realtime, React 19, Vitest, pytest, Playwright, Docker, Render, Vercel.

## Global Constraints

- Keep `YTDLP_PROXY_URL` as the highest-priority operator override and keep the existing WARP pool, IPv4 enforcement, player-client rotation, partial sections, and Cobalt fallback.
- Never expose proxy URLs, service tokens, private source URLs, or Supabase service-role credentials to browser code.
- Derive maximum quality from the current active server-side plan: free 720p, creator 1080p, pro 2160p.
- Accept only public/unlisted rights-attested YouTube media; do not bypass private, paid, DRM, age, or region restrictions.
- Bind the Python API to `127.0.0.1`; require bearer auth; sign callbacks; validate output containment beneath `WORKER_TEMP_ROOT`.
- Keep historical relay migrations and database types readable, but remove every executable relay product path.
- Preserve responsive behavior down to 360 px and use Vidrial semantic tokens and Manrope typography.

---

### Task 1: Add the tested Python acquisition engine

**Files:**
- Create: `services/video-worker/python-acquisition/requirements.txt`
- Create: `services/video-worker/python-acquisition/app/__init__.py`
- Create: `services/video-worker/python-acquisition/app/models.py`
- Create: `services/video-worker/python-acquisition/app/downloader.py`
- Create: `services/video-worker/python-acquisition/app/webhooks.py`
- Create: `services/video-worker/python-acquisition/app/main.py`
- Create: `services/video-worker/python-acquisition/tests/test_downloader.py`
- Create: `services/video-worker/python-acquisition/tests/test_api.py`
- Create: `services/video-worker/python-acquisition/README.md`

**Interfaces:**
- Consumes: `VIDRIAL_ACQUISITION_TOKEN`, `VIDRIAL_ACQUISITION_ROOT`, `VIDRIAL_ACQUISITION_WEBHOOK_URL`, `VIDRIAL_ACQUISITION_WEBHOOK_SECRET`, `MAX_DIRECT_DOWNLOAD_BYTES`, `YTDLP_POT_PROVIDER_URL`.
- Produces: `POST /v1/downloads -> 202`, `GET /v1/downloads/{request_id}`, `DELETE /v1/downloads/{request_id}`, and `GET /healthz`.

- [ ] **Step 1: Write failing model and downloader tests**

```python
def test_plan_height_and_section_are_applied(tmp_path):
    request = DownloadRequest(video_id="dQw4w9WgXcQ", maximum_height=720,
        maximum_duration_seconds=600, output_directory=str(tmp_path),
        output_format="mp4", source_section={"start_seconds": 30, "end_seconds": 45})
    options = build_ydl_options(request, cancel_event=Event(), progress=lambda *_: None)
    assert "height<=720" in options["format"]
    assert options["external_downloader"]["default"] == "ffmpeg"
```

- [ ] **Step 2: Run the focused Python tests and confirm they fail before implementation**

Run: `python -m pytest services/video-worker/python-acquisition/tests -q`

Expected: collection fails because the `app` modules do not exist.

- [ ] **Step 3: Implement validated models, yt-dlp embedding, isolated output discovery, cancellation, error classification, and webhook signing**

```python
class DownloadRequest(BaseModel):
    request_id: str = Field(pattern=r"^[A-Za-z0-9_-]{16,160}$")
    video_id: str = Field(pattern=r"^[A-Za-z0-9_-]{11}$")
    maximum_height: Literal[720, 1080, 2160]
    output_format: Literal["mp4", "webm", "mkv"] = "mp4"
```

- [ ] **Step 4: Implement authenticated asynchronous endpoints with idempotent request IDs and bounded in-memory status**

```python
@app.post("/v1/downloads", status_code=202)
async def create_download(request: DownloadRequest, _: None = Depends(require_token)):
    return registry.submit(request)
```

- [ ] **Step 5: Run Python tests**

Run: `python -m pytest services/video-worker/python-acquisition/tests -q`

Expected: all Python tests pass without making network requests.

- [ ] **Step 6: Commit**

Run: `git add services/video-worker/python-acquisition && git commit -m "feat(worker): add internal Python acquisition API"`

### Task 2: Package and supervise FastAPI in the worker container

**Files:**
- Modify: `services/video-worker/Dockerfile`
- Modify: `services/video-worker/start.sh`
- Modify: `services/video-worker/src/config/env.ts`
- Modify: `services/video-worker/src/index.ts`
- Modify: `render.yaml`
- Modify: `.env.example`

**Interfaces:**
- Consumes: Task 1 `GET /healthz`.
- Produces: a healthy loopback service at `PYTHON_ACQUISITION_URL` before Node readiness becomes true.

- [ ] **Step 1: Add failing env/readiness tests for the Python URL and required-token behavior**
- [ ] **Step 2: Install pinned Python dependencies and copy the API source in the runtime image**
- [ ] **Step 3: Generate per-container secrets when absent, start Uvicorn on loopback, wait for health, and terminate it during graceful shutdown**
- [ ] **Step 4: Add Node readiness probing without logging secrets or endpoint credentials**
- [ ] **Step 5: Run `bun --cwd services/video-worker test` and `bun --cwd services/video-worker run build`**
- [ ] **Step 6: Commit with `git commit -m "feat(worker): supervise Python acquisition runtime"`**

### Task 3: Replace the TypeScript yt-dlp executor with a typed Python client

**Files:**
- Create: `services/video-worker/src/security/python-acquisition-client.ts`
- Create: `services/video-worker/src/security/python-acquisition-client.test.ts`
- Modify: `services/video-worker/src/security/youtube-download.ts`
- Modify: `services/video-worker/src/security/youtube-download.test.ts`
- Modify: `services/video-worker/src/tasks/handlers.ts`
- Modify: `services/video-worker/src/security/youtube-acquisition.ts`

**Interfaces:**
- Consumes: Task 1 REST endpoints.
- Produces: `downloadYouTubeWithPython(input, signal): Promise<AcquiredMedia>` with path/size/extension revalidation.

- [ ] **Step 1: Write failing client tests for 202 polling, typed failure, abort DELETE, auth headers, path escape rejection, and timeout**
- [ ] **Step 2: Implement the client with bounded JSON parsing and redacted errors**

```ts
export type PythonAcquisitionInput = {
  jobId: string;
  taskId: string;
  videoId: string;
  directory: string;
  maximumDurationSeconds: number;
  maximumHeight: 720 | 1080 | 2160;
  outputFormat: "mp4";
  proxy?: YouTubeProxySelection;
  section?: YouTubeSourceSection;
  strategy: YouTubeDownloadStrategy;
};
```

- [ ] **Step 3: Make `assertYouTubeAcquisitionAllowed` return the current active plan height and pass it to every Python request**
- [ ] **Step 4: Remove TypeScript subprocess/path execution while retaining strategy, section parsing, failure types, and proxy planning**
- [ ] **Step 5: Run worker tests and build**
- [ ] **Step 6: Commit with `git commit -m "refactor(worker): route YouTube downloads through Python"`**

### Task 4: Add signed idempotent acquisition webhooks and realtime toasts

**Files:**
- Create: `services/video-worker/src/http/python-acquisition-webhook.ts`
- Create: `services/video-worker/src/http/python-acquisition-webhook.test.ts`
- Modify: `services/video-worker/src/http/server.ts`
- Modify: `services/video-worker/src/http/server.test.ts`
- Modify: `services/video-worker/src/index.ts`
- Create: `supabase/migrations/20260730120000_python_acquisition_callbacks.sql`
- Modify: `src/components/app/layout.tsx`
- Modify: corresponding layout tests if present

**Interfaces:**
- Consumes: HMAC-signed Python callbacks with states `accepted|extracting|downloading|postprocessing|completed|failed|cancelled`.
- Produces: idempotent `processing_events` rows and user toasts through the existing authenticated Supabase Realtime channel.

- [ ] **Step 1: Write failing signature, body-limit, schema, replay, and fixed-copy tests**
- [ ] **Step 2: Add a security-definer SQL RPC that verifies the task/job relationship and inserts a receipt plus event atomically**
- [ ] **Step 3: Add the loopback webhook endpoint and constant-time signature verification**
- [ ] **Step 4: Subscribe to acquisition processing events and show only start/completion/actionable-failure toasts**
- [ ] **Step 5: Run Supabase lint/reset when available plus app and worker tests**
- [ ] **Step 6: Commit with `git commit -m "feat: stream Python acquisition progress"`**

### Task 5: Retire the local-device relay surface

**Files:**
- Delete: `src/components/youtube-clipper/local-relay-recovery.tsx`
- Delete: `src/components/youtube-clipper/local-relay-recovery.test.tsx`
- Delete: `src/routes/api.acquisition.relay.$action.ts`
- Delete: `src/services/acquisition/relay.server.ts`
- Delete: `src/services/acquisition/relay-token.server.ts`
- Delete: `src/services/acquisition/relay-token.server.test.ts`
- Delete: `services/acquisition-helper/**`
- Modify: `src/components/youtube-clipper/authorised-source-recovery.tsx`
- Modify: `src/components/youtube-clipper/authorised-source-recovery.test.tsx`
- Modify: `src/components/app/layout.tsx`
- Modify: `services/video-worker/src/security/acquisition-plan.ts`
- Modify: `services/video-worker/src/security/acquisition-plan.test.ts`
- Modify: `src/config/env.server.ts`, `services/video-worker/src/config/env.ts`, `.env.example`, `render.yaml`, `package.json`
- Regenerate: `src/routeTree.gen.ts` via the TanStack/Vite build only

**Interfaces:**
- Produces: recovery via original upload, owner-controlled URL, Google Drive, Dropbox, or OneDrive only.

- [ ] **Step 1: Update tests to assert pairing/terminal/helper copy is absent and upload recovery is first**
- [ ] **Step 2: Remove the relay UI, route, application services, helper package, scripts, configuration, and active planner tier**
- [ ] **Step 3: Preserve historical status parsing/migrations/types for already-created production rows**
- [ ] **Step 4: Refine the recovery panel hierarchy, concise copy, focus states, and 360 px wrapping using semantic tokens**
- [ ] **Step 5: Run app tests, typecheck, lint, and build to regenerate the route tree**
- [ ] **Step 6: Commit with `git commit -m "refactor: remove local acquisition relay"`**

### Task 6: Documentation and full local verification

**Files:**
- Modify: `docs/VIDEO_WORKER.md`
- Modify: `docs/YOUTUBE_CLIPPER.md`
- Modify: `README.md` if helper commands are documented
- Modify: `docs/superpowers/plans/2026-07-30-python-youtube-acquisition.md` to check completed steps and append results

- [ ] **Step 1: Document why Vercel is not the media plane, the internal REST contract, plan caps, WARP precedence, webhook flow, and residual risks**
- [ ] **Step 2: Run `python -m pytest services/video-worker/python-acquisition/tests -q`**
- [ ] **Step 3: Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`**
- [ ] **Step 4: Run `bun --cwd services/video-worker test`, `bun --cwd services/video-worker run typecheck`, and `bun --cwd services/video-worker run build`**
- [ ] **Step 5: Run browser verification at desktop and 360 px, capture screenshots under `output/playwright/`, and confirm no horizontal overflow or relay controls**
- [ ] **Step 6: Commit with `git commit -m "docs: document Python YouTube acquisition"`**

### Task 7: Publish and production verification

**Files:**
- Modify: this plan’s verification log with non-secret artifact URLs and exact observed results.

- [ ] **Step 1: Push the branch, open a PR, and wait for Vercel preview plus repository checks**
- [ ] **Step 2: Apply the Supabase migration before promoting code that emits Python callbacks**
- [ ] **Step 3: Verify the Render image builds, Python health participates in `/readyz`, and the worker reports protected WARP health**
- [ ] **Step 4: Validate the Vercel preview recovery UI and authenticated worker-status surface**
- [ ] **Step 5: Merge with a normal merge commit, never force-push/rebase/amend/squash, and wait for Vercel and Render production revisions**
- [ ] **Step 6: Submit a rights-attested 15–20 second clip from a previously blocked public test video; confirm Python accepted/downloading/completed events, plan-capped format, `source_tier=warp`, `sectionApplied=true`, ready preview, and downloadable output**
- [ ] **Step 7: Audit logs for secrets/raw URLs, clean disposable fixtures in foreign-key-safe order, and append concrete production evidence**
