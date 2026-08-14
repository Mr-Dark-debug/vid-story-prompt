# Research notes: OpusClip vs Vizard

Checked 2026-07-31. Backlog ID 54; query `opusclip vs vizard`.

## Primary sources reviewed

- OpusClip official pricing (`https://www.opus.pro/pricing`)
- OpusClip Help: Layout and Reframing (`https://help.opus.pro/docs/article/layout-and-reframing`)
- OpusClip Help: Watermarks (`https://help.opus.pro/docs/article/watermark`)
- Vizard official pricing (`https://vizard.ai/pricing`)
- Vizard Help: What does the free plan offer? (`https://help.vizard.ai/en/articles/8767572-what-does-the-free-plan-for-vizard-offer`)
- Vizard Help: How many clips can AI generate? (`https://help.vizard.ai/en/articles/8767566-how-many-clips-can-ai-generate`)
- Vidrial internal feature matrix (`src/domain/features/availability.ts`) and pricing (`src/routes/pricing.tsx`)

## Key competitor facts

- OpusClip:
  - Free tier: 60 credits/month, 1080p max resolution, watermarked, no video editing allowed, clips expire after 3 days.
  - Starter: $15/month for 150 credits, watermark removal, 29-day storage.
  - Pro: $29/month ($174/year for 3,600 credits), multi-aspect ratio, AI B-roll, scheduler, Premiere Pro & DaVinci Resolve XML export.
  - Strengths: Opaque Virality Score ranking, detailed multi-speaker split layouts (2-speaker split, 3-4 speaker grids).

- Vizard.ai:
  - Free tier: 60 credits/month, 720p max resolution, watermarked, 3-day storage retention.
  - Paid tiers: Watermark removal, 4K export, 100 GB storage, social publishing.
  - Strengths: Integrated text-based video editor with explicit manual clipping fallback when automatic candidate detection is thin.

- Comparison overlap:
  - Both offer 60 free credits/month with watermarks and 3-day project retention.
  - OpusClip provides stronger documented multi-speaker layouts and XML export paths.
  - Vizard provides a more flexible manual text-based clipping fallback within the browser editor.

## Vidrial product truth

- Moment discovery, prompt search, complete thought detection, transcript editing, timeline rearrangement, MP4 export: **Available**.
- Animated caption presets, long silence removal: **Beta**.
- Filler word removal, custom fonts, multi-speaker layouts, XML export: **Coming soon**.
- Free plan: $0, 60 source mins, 3 projects, 2 GB, 720p, watermark (1 trial export clean).
- Creator ($18/mo), Pro ($39/mo).

## Editorial angle

OpusClip and Vizard compete directly in automated video clipping. OpusClip is stronger when you want automated virality scoring, multi-speaker split layouts, and timeline XML export for desktop NLEs. Vizard is stronger when you want an in-browser text editor that lets you manually retrieve and trim clips when AI highlight detection fails.

Pricing and features checked on 2026-07-31.
