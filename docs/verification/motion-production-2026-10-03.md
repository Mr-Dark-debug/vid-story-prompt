# Motion Studio production verification — 2026-10-03

## Hosted database

Verified the Vidrial project `vifcdussqjhvhurxzdwq`. Applied only the pending
`20261003010000_motion_studio` migration, then the reviewed
`20261003220000_motion_public_catalog` correction. PR #19's BYOK migrations
`20261003120000` and `20261003130000` were already present and remain intact.
No reset, Vault changes or unrelated seed reset was performed.

Every Motion table has RLS enabled. Anonymous users cannot read the private
prompt source or change the approved catalog. Browser roles cannot mutate
render status or counters or claim worker leases. The public view uses
`security_invoker=true` and a transactionally maintained approved-only RLS
projection without private author IDs. BYOK ciphertext remains unavailable to
browser roles. Motion projects/renders and AI messages/runs remain in Realtime.

The security advisor returned zero errors and 34 warnings: existing permission
and Auth findings plus eight deliberately callable Motion RPC findings. This
does not claim a warning-free database or a full audit of unrelated functions.
The isolated PostgreSQL Motion RLS/lease/metering/cancellation suite and BYOK
regression suites also passed after the new projection migration.

Twenty repository-authored original prompts and verified MP4/poster pairs were
published to immutable approved gallery paths. All 40 assets returned successful
public requests. Counters started at zero; subsequent browser smoke-test views
and use events are real counted interactions.

## Application

Root typecheck, lint, tests and production build passed. Tests: 559 passed,
six skipped; lint: seven existing React Refresh warnings. All 29 Playwright
tests passed, including explicitly mocked authenticated provider boundaries.

The production alias `https://vidrial.vercel.app` returned HTTP 200 for the
prompt hub, collection, detail, generator, guide, Motion documentation and
motion/blog sitemaps. Canonicals and JSON-LD parsed successfully and these
public pages were indexable. Actual browser checks at 360px and 1440px found
no horizontal overflow or uncaught page errors. Reduced-motion previews were
manual, and signup handoff preserved the prompt in session storage using only
an opaque draft ID in the URL. Private motion, chat, clipping and provider
settings paths continued to redirect signed-out visitors to login.

## Renderer

[Linux CI run 37151677591](https://github.com/Mr-Dark-debug/vidrial/actions/runs/37151677591)
verified runtime commit `98798ff4b2131a35fe0462d99f70cc75645fe4b9`.
All 21 motion tests passed with actual Chromium and FFmpeg. Docker cases proved
nonroot execution, read-only root, no credentials, OS network denial,
watermarked MP4 output, a CPU-bound frame timeout, mid-render cancellation
and temporary-file cleanup. Browser fixtures exercised fetch, XHR, WebSocket,
dynamic import, beacon, popup, form, file and parent access denial.

The startup gate independently completed a fresh isolated one-second
H.264/AAC watermarked render and pinned the image to
`sha256:ce9d9564ed7911cb7936950a39be7fa44a3908838cc30fc81f6341fb0fcda8a9`.
The gate took 2.86 seconds; the image occupied 1,482,593,030 bytes. These are
CI-host measurements with the image already built, excluding image transfer.

Windows worker tests also pass with authored Chromium/FFmpeg fixtures;
Docker-specific cases are skipped on that machine because Docker/WSL is absent.
Neither Windows tests nor an ephemeral CI job is a persistent production worker.

## Still requires production host access

Generation, rendering and reference flags remain disabled in the hosted
database until a persistent dedicated Linux Docker controller is deployed and
verified. The provided systemd unit repeats the startup proof before claiming
jobs. The operator's SSH hostname/IP and username are still required.

Real authenticated production model calls, end-to-end production exports,
provider credentials and production-host capacity/cold starts have not been
verified. Motion currently uses the feature-gated platform OpenRouter seam;
the existing chat/clipping BYOK service remains separate. No generation,
export or persistent worker success should be inferred from a ready Vercel
deployment. Follow `services/video-worker/deploy/README.md` to enable each lane.
