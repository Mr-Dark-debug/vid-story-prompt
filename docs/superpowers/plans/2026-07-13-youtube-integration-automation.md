# YouTube integration and automation implementation plan

Source specification: `docs/superpowers/specs/2026-07-13-youtube-integration-automation-design.md`

## Phase 1: persistence and contracts

1. Add a Supabase migration for connection capability/status fields, YouTube channels, automation rules, subscriptions, events, drafts, and publishing jobs.
2. Add RLS, indexes, idempotency constraints, update triggers, scheduler RPCs, and queue integration.
3. Update generated application database types and worker task contracts.
4. Add domain schemas for connection capabilities, automation rules, notifications, drafts, and publishing inputs.

## Phase 2: secure YouTube services

1. Replace the current read-only OAuth helper with state, PKCE, incremental scopes, versioned authenticated token encryption/decryption, refresh locking, and token revocation.
2. Preserve an existing refresh token when Google omits it during incremental consent.
3. Add typed channel, WebSub subscription, and publishing provider adapters.
4. Add safe callback routing and same-origin return-path validation.

## Phase 3: automation and publishing pipeline

1. Add WebSub challenge and notification server endpoints with bounded XML parsing, signature verification, official metadata confirmation, and idempotency.
2. Add automation rule CRUD, source attachment, explicit video-to-asset mapping, and transactional clip-job creation with materialized rights records.
3. Add publishing job creation, scheduling, cancellation, and status services.
4. Add worker handlers for token refresh, resumable YouTube upload, processing-status polling, retry classification, and secret redaction.

## Phase 4: user interface

1. Replace placeholder integration cards with a live YouTube card using official branding and real connection/capability/actions.
2. Add clearly disabled TikTok and Instagram coming-soon cards using maintained brand icons.
3. Add automation rule controls, channel state, reauthorization, and disconnect confirmation.
4. Reposition YouTube connection in the clip wizard as an optional automation/publishing action.
5. Add awaiting-source draft and YouTube publishing controls to clipping results.

## Phase 5: verification and delivery

1. Add unit, component, RLS integration, worker, and browser tests for every new boundary.
2. Run formatting, type checking, linting, unit tests, worker tests, production build, and end-to-end tests.
3. Apply Supabase migrations and configure Google/YouTube, Vercel, and Render secrets without committing them.
4. Verify OAuth, channel state, WebSub, manual clipping without connection, private publishing with a licensed fixture, reconnect, and disconnect flows.
5. Commit in coherent phases, push normally to `main`, inspect deployment logs, and report any Google verification limitations separately from implemented behavior.
