# Research note: How to Turn a Podcast Into Short Video Clips

- Backlog ID: 21
- Primary query: `podcast clip maker`
- Checked: 2026-07-31
- Dominant intent: Learn a practical workflow and evaluate whether an AI podcast clip maker can reduce manual work.
- Intended reader: A podcaster, producer, or editor with an authorised finished episode who needs a repeatable social clipping process.

## Search review

Queries reviewed included `podcast clip maker`, `turn podcast into short video clips`, `podcast clips for social media workflow`, and official help pages for Spotify Clips, YouTube Shorts, Riverside, Descript, OpusClip, and Vizard.

Strong ranking pages generally agree on transcript-led selection, a fast opening, vertical framing, captions, and platform variants. Their common weakness is collapsing candidate generation and editorial approval into one click. Several use a tool's raw suggestion count as if every candidate were publishable. The article instead separates source quality, retrieval, standalone meaning, boundaries, framing, captions, audio, rights, and distribution.

## Primary and official sources

1. [Spotify for Creators: Clips](https://support.spotify.com/la/creators/article/clips/) — current upload workflow, one-clip-per-episode rule, 15–90 second requirement, file types, size, audio, placement, and analytics.
2. [YouTube: Understand three-minute Shorts](https://support.google.com/youtube/answer/15424877?hl=en-EN) — current duration classification and claimed-content limitation.
3. [YouTube: Sharing links with your audiences](https://support.google.com/youtube/answer/13748639) — Shorts description and comment URLs are non-clickable; related-video and profile-link alternatives.
4. [Riverside: About Magic Clips](https://support.riverside.com/hc/en-us/articles/12124048765981-About-Magic-Clips) — documented AI highlights and preference controls.
5. [OpusClip: About the result clips](https://help.opus.pro/docs/article/9442054-about-the-result-clips) — candidate counts by source length and recovery through topic/timeframe controls.
6. [Vizard: How many clips can AI generate?](https://help.vizard.ai/en/articles/8767566-how-many-clips-can-ai-generate) — clip yield varies with source speech, suitability, length, and duration preference.

## Strong result and competitor material

1. [Descript: How to pick clips for social media](https://www.descript.com/blog/article/how-to-choose-clips-for-social-media) — emphasizes hooks and standalone meaning.
2. [Riverside: How to make shareable podcast clips](https://riverside.fm/blog/podcast-clips) — recording-to-clips workflow and distribution variants.
3. [PodReels research](https://arxiv.org/abs/2311.05867) — frames selection and teaser editing as a human-AI co-creation problem.
4. [Google: Building your podcast channel](https://services.google.com/fh/files/events/podcast-best-practices_en.pdf) — official YouTube podcast and clip channel guidance.

## Community signals

- [A 2026 r/podcasting workflow discussion](https://www.reddit.com/r/podcasting/comments/1qn6wi0/how_do_you_go_about_creating_clips_from_your/) describes dissatisfaction with automatic selections and a preference for using AI after identifying known-good moments.
- [A discussion of clip performance versus podcast listening](https://www.reddit.com/r/podcasting/comments/1ccrncd/how_much_do_clips_matter/) illustrates that social views do not automatically convert to full-episode plays.
- [A creator workflow thread](https://www.reddit.com/r/podcasting/comments/15z18ty/what_are_the_best_workflows_for_creating_clips/) highlights caption styling, candidate overload, and time spent reviewing long sources.

These are qualitative pain points, not evidence for a universal tool ranking or conversion rate.

## Vidrial product truth checked

- `src/domain/connectors/registry.ts`: public Podcast RSS import is Available; several named podcast host integrations are Coming soon, with public RSS already available.
- `src/domain/features/availability.ts`: moment discovery, prompt search, complete-thought detection, standalone clarity, transcript editing, caption correction, MP4 export, and direct publishing are Available; animated caption presets and safe-area/brand work are Beta; subject tracking, multi-speaker layouts, SRT/VTT, and B-roll are Coming soon.
- `PRODUCT_SPEC.md`: sources require rights attestation or owner control, and AI operations remain reviewable.

## Original contribution

The article uses an eight-stage approval workflow and a source card that keeps rights, context, boundary quality, visual crop, audio, and distribution separate. The non-commodity decision rule is the four-question “survive separation” test: identify the subject, change, payoff, and missing context before styling a candidate.

## Claims deliberately avoided

- No claim that a tool can predict virality.
- No assertion that every episode should produce a fixed number of clips.
- No fabricated hands-on product test.
- No claim that social clip views reliably convert to podcast listens.
- No Vidrial claim for planned speaker tracking, multi-speaker layouts, B-roll, or subtitle-file export.
