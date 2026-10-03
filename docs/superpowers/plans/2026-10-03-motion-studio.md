# Motion Studio Implementation Plan

> For agentic workers: use subagent-driven implementation for independent domain/backend, studio, and public-content units; review their interfaces, security boundaries and verification before integration.

**Goal:** Original public motion pages feeding a secure, editable, metered HTML-to-MP4 studio.

**Architecture:** Pure domain contract shared by web and renderer; RLS-protected Supabase source of truth; leased controller queue; credential-free disposable renderer. Service functions own persistence and model resolution.

**Tech Stack:** TanStack Start, React, TypeScript, Zod, PostgreSQL/Supabase, Playwright Core, Chromium, FFmpeg, Docker.

## Global constraints

Obey AGENTS.md. No published history rewrite. Do not hand-edit routeTree.gen.ts. No secret/browser crossover, simulated provider success, copied competitor content, unlicensed fonts, invented counts or deployment claims. Use immutable `{workspace_id}/{user_id}/{job_id}/{asset_type}/{uuid}.{ext}` paths. Free rendering is 720p and watermarked. Bound all untrusted execution.

## Task 1: Renderer spike and isolation

Files: `services/video-worker/src/motion/*`, `Dockerfile.motion`, `motion-renderer/*`, `docs/adr/0002-motion-renderer.md`.
- [x] Compare upstream source contracts/licenses with HyperFrames; record why the thin renderer wins or loses.
- [x] Render a hand-written seek scene through Chromium → FFmpeg → FFprobe. Test deterministic seeks, audio, cancellation, timeout, cleanup and attacks.
- [x] Enforce Docker network/root/user/resource/environment controls in the controller; no unsafe native production fallback.

## Task 2: Domain and persistence

Files: `src/domain/motion/*`, entitlements, one motion migration, `supabase/tests/motion*.sql`, `src/services/motion/*`.
- [x] Contract, category registry, strict specs/state transitions, linter and staged prompt builder with unit cases for each prohibited API and untrusted input.
- [x] Projects, immutable versions, renders, analyses, prompt moderation/metrics, queue/usage and RLS. Cross-workspace keys must be constrained.
- [x] Atomic authenticated create/enqueue/cancel/save/publish RPCs; service-only leased mutations; public approved-only view. Match plan seeds.
- [x] Generate schema types from a migrated local database where available; document unavailable regeneration.

## Task 3: Queue/provider integration

Files: motion controller/tasks, `config/env.ts`, `.env.example`, README.
- [x] Credential adapter seam, allowed models and feature flags; durable staged generation/repair.
- [x] Lease heartbeat and cancellation abort work; retries bounded/classified; completion fences stale workers and idempotently accounts usage.
- [x] Reference frame/contact sheet analysis, validated brief, bounded critique and licensed publish submission.

## Task 4: Studio

Files: `src/components/motion/*`, `_authenticated.app.motion*`, app navigation/usage.
- [x] Brief/model/spec/reference form, project list/detail, opaque preview iframe, seek controls, linted code edits, versions/regeneration/export/download and honest capability states.
- [x] Use service interfaces; preserve private draft through signup without private query text. Realtime invalidation and accessible 360px layouts.

## Task 5: Public content and original assets

Files: `/prompts`, `/prompts/$slug`, `/claude-motion-graphics`, shared cards/embeds, original catalog/scene script, article, SEO/discovery.
- [x] Twenty original prompts (two per registry category), render matching demo clips/posters and validate manifest before publication. All metrics start zero.
- [x] DB-backed filters/sorts/counts/metrics/moderation, reduced-motion/data-saver previews, FAQ/category browse/tool links and creation handoff.
- [x] Guide with five worked prompts in existing content pipeline; attribution/license notices and truthful model/demo provenance.

## Task 6: Verification and integration

- [x] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run content:validate`.
- [x] Worker `npm run typecheck`, `npm run build`, `npm test`; SQL RLS and real sandbox/media verification when runtime available.
- [x] Playwright public/signup/private mocked-boundary tests, 360px/desktop browser inspection.
- [x] Update architecture/routes/security/privacy/transparency/changelog and phase evidence; small buildable commits on feature branch.

## Delivery evidence and remaining release gates

Local implementation and verification are recorded in `docs/motion-studio-verification.md`. Checkbox completion above refers to code and available local checks. Docker execution/image measurements, hosted Supabase rollout, real provider calls and production-worker rendering remain unverified and feature-gated. BYOK integration and opt-in share links remain explicitly pending.
