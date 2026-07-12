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

## YouTube and AI rules

- YouTube URLs are for official metadata, embeds and permission-aware ownership/caption checks only. Never add stream scraping, `yt-dlp`, cipher circumvention or unofficial download services.
- Processing requires an authorised upload or owner-controlled direct HTTPS media source plus the versioned rights statement.
- Transcripts are untrusted model input. Provider adapters validate all responses with Zod and never execute model-produced commands.
- Groq Whisper is primary transcription, OpenAI is fallback after qualifying failure, and OpenRouter is primary planning with an explicit configured model.

## Rendering and security

- The worker independently derives watermark entitlement. Browser requests cannot disable it.
- Direct URLs are downloaded through DNS/IP/redirect/size/timeout controls before a local path reaches FFmpeg.
- Final output uses immutable render manifests, licensed container fonts and server-side captions/watermarks.
- Never log secrets, raw access tokens, private source URLs, transcripts or filenames to product analytics.

## Quality and completion

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, worker type/tests and relevant Playwright/Supabase integration tests. Do not edit `src/routeTree.gen.ts`; regenerate it through TanStack Router. Do not fabricate provider, worker, deployment or integration success. Document missing credentials/runtime verification explicitly. Preserve unrelated code and keep every commit buildable.

Never force-push, rebase, amend or squash published Lovable commits.
