# ADR 0002: deterministic HTML rendering in a disposable sandbox

Status: selected; local native authored-fixture checks and production Docker sandbox checks are separate gates.

Vidrial owns a thin Playwright Core renderer around `window.DURATION` and `async window.seek(t)`. Chromium paints PNG frames at exact `i/fps` times. FFmpeg consumes a backpressured image2pipe stream, encodes H.264/yuv420p/faststart and optional AAC from an OfflineAudioContext AudioBuffer. Every output passes pixel/determinism and FFprobe gates before upload. Repeated seeks are compared after seeking backward. Max 60 seconds, 3600 frames, 1920 pixels per edge, 256KB source, 128MB output.

## Spike comparison

Inspected `heygen-com/hyperframes` source on 2026-10-03. Its Apache-2.0 platform offers timeline adapters, asset resolution, a studio/server, registry and richer media workflows. Those features are valuable for a general HTML production environment. Our public contract instead admits one self-contained, offline scene with arbitrary-order seeks and no user imports. Adapting the larger asset/server surface would still require our own OS sandbox, lint policy, quotas and lease fences. The smaller in-house renderer makes these limits auditable and preserves control over egress and frame timeouts. No HyperFrames code is copied. No Remotion runtime or user-submitted Remotion code is used.

The upstream motion repositories informed the seek/beat/keyframe/review approach. Their external asset and live preview paths are not admitted into Vidrial's execution contract. `alsharmani0/canvas-animation-skills` was unavailable during research and no content was adapted. The `iart-ai/motion-skills` repository is a hub linking seventeen separate skill packs; its accessible README and source links were reviewed. Licensing evidence lives in THIRD_PARTY_NOTICES.md.

## Security boundary

The trusted motion controller has queue/provider/storage credentials; the renderer process never does. It invokes a new dedicated Docker container with `--network=none`, non-root UID, read-only root, all capabilities dropped, no-new-privileges, pinned seccomp profile, private IPC, bounded tmpfs and explicit CPU/memory/pid/file limits. Only a read-only input directory and a fresh bounded output directory are mounted. Nothing exposes a Docker socket, source-acquisition path, provider key or Supabase environment to Chromium. Do not run the controller beside acquisition on an untrusted shared host; Docker daemon access is privileged and belongs to the dedicated renderer control plane.

Chromium's own sandbox remains enabled. The seccomp profile comes from the pinned Microsoft Playwright v1.61.1 Docker profile and permits user-namespace creation while retaining a default deny policy. Hosts must permit unprivileged user namespaces; if Chromium cannot sandbox, the render fails. Never add `--no-sandbox`, SYS_ADMIN, host IPC, host networking or host mounts as a workaround.

Scenes run in an opaque `<iframe sandbox="allow-scripts">`, with strict CSP and no same-origin, forms, popups or navigation grants. Context interception rejects every request except data/blob; WebSockets, service workers and downloads are blocked. The renderer waits for font readiness. Manrope, JetBrains Mono and EB Garamond are bundled as data-URL fonts under OFL licenses. No network font load is needed. CSS/JS source is also statically linted before enqueue and again by the worker; lint is defense in depth, not the isolation boundary.

Per-frame timeout closes Chromium, total timeout removes the container by its generated name even if the Docker CLI died, and `finally` removes task files. Cancellation and lost leases abort encoding and kill the sandbox; completion rejects stale leases. Worker-derived plans decide watermarking. Native rendering exists only as a test library for trusted fixtures; submitted HTML has no production native fallback.

## Reproduction and rollout

Build from repository root with `docker build -f services/video-worker/Dockerfile.motion -t vidrial-motion-renderer:local .`. Run the sandbox integration suite on a Docker host before enabling motion_runtime_config render_enabled. Image-size/cold-start measurements must be recorded from that actual build; no invented measurements are reported. The existing acquisition worker image stays unchanged. A separate controller role polls only motion tasks. Deploy web/schema/controller/runtime together and enable model/reference/render gates individually after verification.
