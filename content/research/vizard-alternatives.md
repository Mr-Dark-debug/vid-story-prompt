# Research notes: Vizard Alternatives

Checked 2026-07-31. Backlog ID 48; query `vizard alternatives`.

## Primary sources reviewed

- Vizard official pricing page (`https://vizard.ai/pricing`)
- Vizard Help: What does the free plan offer? (`https://help.vizard.ai/en/articles/8767572-what-does-the-free-plan-for-vizard-offer`)
- Vizard Help: How many clips can AI generate? (`https://help.vizard.ai/en/articles/8767566-how-many-clips-can-ai-generate`)
- OpusClip pricing and docs (`https://www.opus.pro/pricing`)
- Descript pricing and docs (`https://www.descript.com/pricing`)
- quso.ai pricing and docs (`https://quso.ai/pricing`)
- Submagic pricing and docs (`https://www.submagic.co/pricing`)
- Vidrial internal feature matrix (`src/domain/features/availability.ts`) and pricing (`src/routes/pricing.tsx`)

## Key competitor facts

- Vizard.ai provides automatic video highlight clipping, auto-reframing, text-based editing, and manual clipping fallback.
- Free plan: 60 credits/month, 720p export max, mandatory watermark, 3-day storage retention.
- Creator & Business plans: Watermark removal, 4K export support, social scheduling, 100 GB storage.
- Key alternatives:
  1. Vidrial: Explainable transcript search, complete-thought verification, transparent source minute accounting.
  2. OpusClip: Credit-based automated clipping with virality scoring and multi-speaker split layouts.
  3. Descript: Document-style script editing with Underlord AI and multi-track audio control.
  4. quso.ai: Integrated clipping with a social content planner and multi-platform auto-publishing calendar.
  5. Submagic: Caption-first short-form editing with animated caption presets and Magic Clips add-on.

## Vidrial product truth

- Moment discovery, prompt search, complete thought detection, transcript editing, timeline rearrangement, MP4 export: **Available**.
- Animated caption presets, long silence removal: **Beta**.
- Filler word removal, custom fonts, multi-speaker layouts, XML export: **Coming soon**.
- Free plan: 60 source minutes/month, 3 active projects, 2 GB storage, 720p, watermark (1 watermark-free trial export).
- Paid plans: Creator ($18/mo) 600 mins, Pro ($39/mo) 1,800 mins.

## Editorial angle

Vizard combines automated clipping with a manual text editor, but its credit model and short storage retention on lower tiers can limit workflows. Creators seeking alternatives should choose based on whether their priority is explainable selection (Vidrial), automated candidate volume (OpusClip), deep script editing (Descript), built-in social scheduling (quso.ai), or caption-heavy finishing (Submagic).

Pricing and features checked on 2026-07-31.
