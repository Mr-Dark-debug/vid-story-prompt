# YouTube Clipper Reliability and Publishing Hardening Design

**Date:** 2026-08-14

**Status:** Approved by the supplied implementation brief; execution may proceed without another design checkpoint.

## Outcome

Vidrial should turn an authorised ordinary public or unlisted YouTube video into a set of explainable, editable clips through one bounded, observable pipeline. The same candidate data drives the job gallery and editor; the same immutable edit manifest drives preview and final rendering; publishing remains an explicit, separately authorised action in the existing connector and automation system.

The design does not weaken source rules, add cookies, introduce unproxied production downloads, or imply that scores guarantee performance.

## Acquisition architecture

The existing Node worker remains the queue, policy, storage, retry, and audit coordinator. Its loopback Python yt-dlp service remains the primary download executor. The bounded acquisition plan is:

1. Operator proxy, when `YTDLP_PROXY_URL` is configured.
2. A deduplicated embedded or sidecar WARP pool.
3. The authenticated self-hosted Cobalt service.
4. `awaiting_authorised_source` with manual upload recovery.

There is no direct production tier. Every attempt is persisted once, has a finite strategy set, uses conservative pacing, and classifies failure into sanitized operational reason codes. `/health/proxy` reports tier readiness without returning proxy URLs, IP addresses, tokens, raw stderr, private source URLs, or fingerprints.

The active Render blueprint gains an optional free Cobalt service and worker wiring. Free-service sleep and datacenter blocking remain known reliability limits. A persistent WARP sidecar and a larger worker stay documented configuration options requiring an operator spending decision.

## Candidate planning and scoring

Planning becomes a deterministic-plus-LLM pipeline:

1. Normalize transcript cues and split on pauses/sentence boundaries.
2. Generate bounded candidate windows within plan duration constraints.
3. Pre-score windows deterministically for duration, speech density, opening-hook shape, completeness, and transcript coverage.
4. Send only the best bounded windows to the configured model using the existing structured Zod contract.
5. Repair one malformed response with explicit validation feedback, then use a deterministic fallback if the provider remains unavailable or invalid.
6. Clamp timestamps and scores, persist candidate titles/social copy/explanations, deduplicate overlaps, and select a topic-diverse set.

The pipeline never sends an unbounded transcript request. Candidate explanations describe hook, clarity, standalone completeness, story, and relevance. Score bands are shared by the gallery and editor:

- 80-100: strong (`--color-success`)
- 65-79: promising (`--color-warning`)
- 40-64: needs work (`--color-danger`)
- 0-39: limited (muted neutral)

## Results gallery and title workflow

The job service returns candidates and clips together, enforcing workspace ownership through the authenticated server client and RLS. The ready job page renders a responsive candidate gallery with:

- a real signed preview when a rendered clip exists;
- editable suggested title and platform-copy summary;
- overall score badge plus component scores;
- collapsed “Why this score” explanation;
- sort and minimum-score filters;
- a direct editor action;
- selection state for bounded batch export actions.

Title regeneration is clip-scoped. It reuses the candidate transcript excerpt, existing score explanation, and validated structured response. It never reruns the whole job.

## Immutable edit manifest and editor

The editor owns a typed, versioned manifest containing:

- timing and aspect ratio;
- fit/fill/center/blur crop plus normalized focal point;
- safe-area preview toggle;
- caption text, cues, font family, size, weight, alignment, position, background, stroke, shadow, keyword/active-word settings, and animation;
- text overlays with bounded position, timing, and style;
- gain, mute, fades, and loudness normalization;
- title and social-copy variants.

Undo and redo are in-memory history operations. Save creates an immutable version. Restore creates a new version derived from an old one; it does not mutate history. Compare exposes current and saved manifest metadata without pretending to be a rendered side-by-side comparison when no separate preview exists.

All server mutations verify that the clip belongs to the current workspace before reading or writing versions.

## Caption and FFmpeg rendering

The worker uses licensed system fonts already in the image: Liberation Sans, Liberation Serif, and Liberation Mono. ASS generation consumes immutable word/cue timing and supports:

- active-word karaoke using centisecond `\\k` tags;
- line-by-line reveal using timed dialogue events;
- pop-in using bounded `\\fad` and `\\t` transforms.

ASS values are escaped and clamped. The browser preview maps the same manifest choices to a close visual representation, while the worker output remains authoritative.

The FFmpeg graph applies crop/fit/fill/blur and focal point, safe scaling, text overlays, caption burn-in, gain/mute/fades, optional EBU R128 loudness normalization, and the server-derived watermark. Final exports continue to write immutable render manifests and sidecars.

## Publishing connectors

YouTube remains the reference publisher. TikTok, Instagram, Facebook, and LinkedIn gain adapters only inside the existing connector registry, OAuth service, encrypted-token store, job queue, and automation approval model.

Each platform has three independent states:

- catalog visibility;
- credential configuration;
- executable connection/publishing eligibility.

The UI enables OAuth only when required server credentials exist and the adapter is implemented. A connection grants publishing only for its explicit platform/scopes. Automation rules default to review-before-publish. No connector reports success without an accepted official API response.

Provider requirements are explicit:

- TikTok: Content Posting API app, `video.publish`, public-post audit for public visibility, verified pull-upload domain or upload flow.
- Instagram: Meta app, Instagram professional account linked to a Facebook Page, content publishing permissions, and app review/live mode.
- Facebook: Meta app, Page access, page publishing permissions, and app review/live mode.
- LinkedIn: LinkedIn app, `w_member_social` or approved organization access, current version headers, and video upload/finalize support.

Absent credentials or review leave a platform honestly disabled with a concrete setup checklist.

## Security and privacy

- Browser code receives only public catalog state, signed media URLs, and sanitized job/provider state.
- OAuth uses PKCE, signed state, exact callbacks, encrypted server-only tokens, and narrowly requested scopes.
- Service-role, worker, Cobalt, proxy, and provider credentials never enter client bundles or events.
- Source and rendering bounds remain plan-derived on the server and independently enforced by the worker.
- Acquisition, render, and publish handlers stay idempotent and cancellation-aware.

## Verification

Local acceptance requires app typecheck, lint, unit tests, production build, worker typecheck/build/tests, Python tests, Playwright, and available Supabase integration coverage. Rendering tests inspect generated filter graphs and ASS timing; provider tests use mocked official API responses and verify token/scope/error handling.

Production acceptance additionally requires current Vercel and Render revisions, healthy public/readiness endpoints, protected acquisition diagnostics, one real authorised source job, scored gallery output, two caption styles, one downloadable export, and a YouTube publish only if live credentials are configured. External account review, paid proxy, or paid Render requirements remain explicitly blocked rather than simulated.

