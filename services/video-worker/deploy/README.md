# Dedicated Linux Motion Studio host

The trusted controller needs a Linux Docker daemon. Vercel functions and the
existing source-acquisition worker cannot provide this boundary. The HTML job
container never receives provider credentials or the Docker socket. A Linux CI
check proves the image independently; it is not a persistent production worker.

Use a dedicated Linux VM with Node.js 22, Docker Engine, FFmpeg/FFprobe, Git,
systemd and unprivileged user namespaces. Start with 4 CPU cores, 8 GB RAM and
20 GB temporary disk. Do not disable Chromium's sandbox to work around a kernel
or AppArmor failure. The controller's Docker access is effectively host-root
access, so this machine must not share unrelated services or sensitive files.

The seccomp profile keeps `clone3` denied with errno 38, matching
[Moby's default profile](https://github.com/moby/profiles/blob/main/seccomp/default.json).
Modern glibc can then fall back to the permitted `clone` path for Node/Chromium
threads. This does not grant extra container capabilities or disable Chromium
sandboxing. FFmpeg decoder and filter threads are explicitly bounded as well as
the encoder, since host CPU discovery can otherwise exceed the container PID cap.

## Prepare the host

1. Check out the reviewed production commit in `/opt/vidrial`. Install worker
   dependencies with `npm ci` in `services/video-worker`, then run its typecheck,
   tests and build. Build the renderer from the repository root:

   ```sh
   docker build -f services/video-worker/Dockerfile.motion -t vidrial-motion-renderer:release .
   ```

2. Create a `vidrial-motion` system account and group, add it to the Docker group,
   and create `/var/lib/vidrial-motion` owned by that account with mode `0700`.
   The source checkout must be readable but not writable by this account.

3. Create `/etc/vidrial/motion.env`, owned by root with mode `0600`. Supply the
   intended Supabase server credentials and provider key through your secret
   manager. Do not put them in an image, Git, a command argument, or the
   renderer environment. Use the root `.env.example` for all optional settings.
   Required controller configuration:

   ```dotenv
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=FROM_SECRET_MANAGER
   WORKER_ID=motion-linux-1
   WORKER_TEMP_ROOT=/var/lib/vidrial-motion
   WORKER_MOTION_ENABLED=true
   WORKER_TASK_INCLUDE_TYPES=motion_generate,motion_render,motion_analyze_reference
   WORKER_CONNECTOR_TASKS_ENABLED=false
   WORKER_AI_RUNS_ENABLED=false
   MOTION_SANDBOX_IMAGE=vidrial-motion-renderer:release
   MOTION_SECCOMP_PROFILE=/opt/vidrial/services/video-worker/motion-seccomp.json
   MOTION_GENERATION_ENABLED=false
   MOTION_REFERENCE_ENABLED=false
   MOTION_CRITIQUE_ENABLED=false
   ```

4. Run `node scripts/check-motion-host.mjs` from the worker directory with
   configuration passed through a secret manager or a private environment file
   using Node's `--env-file` option. Never make the root-only systemd file world
   readable. The check proves Linux Docker, nonroot execution, read-only root,
   no secrets, OS network denial, real Chromium/FFmpeg H.264+AAC rendering and
   watermarking. It records the exact image ID and elapsed time without claiming
   a queue job.

5. Run the complete Docker integration tests with
   `MOTION_DOCKER_TEST_IMAGE=vidrial-motion-renderer:release` and the absolute
   `MOTION_TEST_SECCOMP_PROFILE` path. They also exercise timeout/cancellation
   cleanup. Record image bytes with `docker image inspect IMAGE --format
   '{{.Size}}'` and keep the startup check result with deployment evidence.

6. Install `vidrial-motion.service` in `/etc/systemd/system/`, run
   `systemctl daemon-reload`, then `systemctl enable --now vidrial-motion`.
   Inspect `journalctl -u vidrial-motion`. Every startup repeats the host proof
   before claiming work and pins the process to the verified image ID.

## Enable one capability at a time

Keep database `motion_runtime_config` flags disabled until this host is running
and the matching provider settings are verified. For exports, enable
`render_enabled` in that singleton row and `MOTION_RENDER_ENABLED=true` in the
Vercel server environment, then redeploy Vercel. These gates are independent.
Do not enable generation/reference based solely on a successful render test.

The existing motion provider seam uses the platform OpenRouter key. Generation
also needs `OPENROUTER_API_KEY`, `MOTION_GENERATION_ENABLED=true` and the same
verified `MOTION_ALLOWED_MODELS` allowlist on the controller and Vercel, plus
the database allowlist and generation flag. Reference analysis additionally
needs consent and a vision model listed in `MOTION_VISION_MODELS`. Motion BYOK
integration is separate from the already shipped chat/clipping BYOK service.

Run a real signed-in manual scene export, check the private signed download,
FFprobe dimensions/duration/codec/audio, usage charging, cancellation and a
cross-workspace access denial before announcing availability. Test the actual
production alias after deployment. To stop new jobs, turn the corresponding
database flags off first; stopping the controller preserves durable queued
tasks, and its shutdown aborts the current operation for lease recovery.

Do not mount additional host directories into HTML containers to fix deployment
issues. Input/output use the same real `/var/lib/vidrial-motion` paths visible
to the host Docker daemon.
