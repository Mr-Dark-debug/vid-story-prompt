# Motion Studio design

The accepted design is the user's 2026-10-03 Motion Studio specification, implemented on `feat/motion-studio` from `origin/main` in an isolated worktree. Claude's BYOK checkout is preserved. No deployment, history rewrite, or production migration is part of local implementation.

## Decisions

- Use an in-house deterministic HTML renderer after comparing HyperFrames. A privileged controller handles queue/database/provider calls; a disposable Docker container runs Chromium with no credentials, no network, a read-only root, a bounded job mount and explicit CPU/memory/pid/time limits. Never run submitted HTML in the controller.
- Domain contract/lint/prompt building are shared with the renderer through a build step. Frame zero, midpoint and final frame are inspected; FFprobe validates codec, dimensions, duration and optional audio. MP4 is delivered only after these gates.
- Use dedicated motion tasks with the existing leased queue conventions rather than pretending a clip job has source media. Workspace-serialized enqueue RPCs reserve render seconds, enforce concurrency/rate/plan limits and idempotency. Service-only completion commits usage once. Cancellation fences writes.
- Keep provider work behind `completeText/completeJson` and feature-gated platform OpenRouter credentials until the separate BYOK work merges. Configured models, never guessed names, drive the picker.
- Use private immutable versions and render objects. Approved official/community prompts have public gallery assets and real zero-initialized counters. Community licensing/moderation and reports are independent from private projects.
- Public prompt details and collections share `/prompts/$slug`; a resolver identifies registered collection slugs before looking up prompt slugs, avoiding two identical dynamic routes.
- No personal prompt content in signup URLs: use a browser session draft and an opaque identifier. Authenticated persistence/queue work goes through services.
- Brand guide overrides older conflicting serif/font descriptions in DESIGN_SYSTEM.md. Use shared Logo, current semantic tokens and Manrope.

## Verification and release gates

Run web typecheck/lint/tests/build/content validation; worker typecheck/build/tests; real Chromium/FFmpeg smoke and sandbox attacks; SQL isolation/counter/moderation/lease tests; public browser checks at 360px/desktop and authenticated tests at explicitly mocked model boundaries. Preserve exact evidence and report absent Docker, credentials or hosted verification. Feature availability is gated by actual schema/provider/renderer capabilities, and unimplemented paths are disabled.
