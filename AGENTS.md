<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history force pushing, or rebasing/amending/squashing commits
> that are already pushed as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# Vidrial engineering rules

## Mission and architecture

Vidrial turns authorised source media into explainable, editable video work. The TanStack Start application owns the web experience, server-verified Supabase sessions, workspace authorization, usage enforcement and signed URLs. PostgreSQL is the source of truth. The Docker video worker owns FFmpeg/FFprobe, controlled direct-media downloads, transcription, planning and rendering.

## Boundaries

- Browser code uses only the Supabase publishable key. Service-role credentials are server/worker only.
- Route components delegate persistence, queue and provider work to services.
- All user-owned tables and private Storage paths are protected by workspace RLS.
- Queue handlers are idempotent, leased, heartbeat-driven, cancellation-aware and retry classified.
- Job/task statuses come from `src/domain/clipping/types.ts`; plan rules come from `src/domain/clipping/entitlements.ts` and matching database seeds.
- Object paths use `{workspace_id}/{user_id}/{job_id}/{asset_type}/{uuid}.{extension}` and are immutable.

## Rendering and security

- The worker independently derives watermark entitlement. Browser requests cannot disable it.
- Direct URLs are downloaded through DNS/IP/redirect/size/timeout controls before a local path reaches FFmpeg.
- Final output uses immutable render manifests, licensed container fonts and server-side captions/watermarks.
- Never log secrets, raw access tokens, private source URLs, transcripts or filenames to product analytics.

## Brand identity

- Read `docs/BRANDIDENTITY.md` before changing logos, colours, typography, navigation branding, authentication branding, or marketing presentation.
- Use `src/components/primitives/logo.tsx` for every product logo. The PNGs in `docs/` are designer references with baked checkerboards and must not be embedded directly in the application.
- Use the semantic tokens in `src/styles.css`. Vidrial Charcoal, Medium, Cool, and Coral are the approved palette; coral is a controlled accent, not a substitute for semantic status colours.
- Museum Sans requires licensed webfont files. Until they are supplied, use the documented Manrope fallback and do not download or commit an unlicensed copy.
- Preserve the mark geometry, clear space, contrast, minimum sizes, and approved dark/light treatments documented in `docs/BRANDIDENTITY.md`.

## Quality and completion

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, worker type/tests and relevant Playwright/Supabase integration tests. Do not edit `src/routeTree.gen.ts`; regenerate it through TanStack Router. Do not fabricate provider, worker, deployment or integration success. Document missing credentials/runtime verification explicitly. Preserve unrelated code and keep every commit buildable.

Never force-push, rebase, amend or squash published Lovable commits.

## Connector rules

- `src/domain/connectors/registry.ts` is the product catalog source of truth. UI code must not maintain independent connector lists.
- Import, publishing and automation capabilities are separate permission boundaries. A connection for one never grants another silently.
- OAuth uses PKCE, signed state, exact callbacks and encrypted server-only tokens. Provider tokens and permanent object-store credentials never enter browser responses.
- Coming-soon connectors remain non-executable and may only record waitlist interest. Never simulate OAuth, connection, import progress or provider success.
