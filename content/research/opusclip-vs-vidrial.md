# Research notes: OpusClip vs Vidrial

Checked 2026-07-31. Backlog ID 47; query `opusclip vs vidrial`.

## Primary sources reviewed

- OpusClip official pricing page (`https://www.opus.pro/pricing`)
- OpusClip Help: Plans and credits (`https://help.opus.pro/docs/article/plans-and-credits`)
- OpusClip Help: Watermarks and project expiry (`https://help.opus.pro/docs/article/watermark`)
- OpusClip Help: Layout and Reframing (`https://help.opus.pro/docs/article/layout-and-reframing`)
- Vidrial internal feature availability matrix (`src/domain/features/availability.ts`)
- Vidrial internal pricing table (`src/routes/pricing.tsx`)

## Key competitor facts

- OpusClip operates on a strict minute-for-credit model (1 credit per 1 minute of source video processed).
- Free tier: 60 credits/month, 1080p max resolution, watermarked, no video editing allowed, clips expire and become non-exportable after 3 days.
- Starter tier: $15/month for 150 credits/month, watermark removal, 29-day project storage.
- Pro tier: $29/month (or $174/year for 3,600 annual credits), multi-aspect ratios, AI B-roll, social scheduler, export to Premiere Pro / DaVinci Resolve XML.
- Core mechanism: Opaque virality-score ranking and automated clip extraction.

## Vidrial product truth

- Free tier: $0/month, 60 source minutes/month, 3 active projects, 2 GB storage, 720p exports, watermarked with 1 watermark-free trial export.
- Creator plan: $18/month ($15/month annual), 600 source minutes/month, 50 GB storage, 1080p exports, watermark-free, AI edit plans, captions, uploaded B-roll, version history.
- Pro plan: $39/month ($32/month annual), 1,800 source minutes/month, 250 GB storage, 4K exports, priority processing.
- Executable/Available features: AI moment discovery, prompt moment search, complete thought detection, standalone clarity scoring, transcript editor, caption correction, timeline rearrangement, MP4/ZIP exports, direct publishing, scheduling.
- Beta features: Animated caption presets, long silence removal, brand colours, team collaboration.
- Planned / Coming soon features: Filler word removal, subject tracking, multi-speaker layouts, custom fonts, XML export (Premiere/DaVinci), SRT/VTT export, AI B-roll generation.

## Result gap & editorial angle

Most comparisons list feature checkmarks without addressing workflow control. OpusClip forces reliance on a proprietary virality score with fixed candidate cuts and aggressive project expiration on lower tiers. Vidrial provides explainable, transcript-led moment search with complete-thought verification, allowing creators to inspect and edit the underlying plan before rendering.

Pricing and features checked on 2026-07-31.
