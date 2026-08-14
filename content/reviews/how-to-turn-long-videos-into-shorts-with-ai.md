# Independent review: How to Turn Long Videos Into Shorts With AI

- Backlog ID: 2
- Article: `content/blog/how-to-turn-long-videos-into-shorts-with-ai.md`
- Research note: `content/research/how-to-turn-long-videos-into-shorts-with-ai.md`
- Reviewed: 2026-07-31
- Verdict: **PASS**

## Publication decision

The article itself is accurate, practical, well sourced, and substantially more useful than the prevalent three-step product pitches. Its context-budget rubric, boundary-first order, cold-open test, worked example, and rejection log give the reader concrete decisions rather than generic encouragement.

It cannot pass the full publication gate while its contextual product CTA leads to a page that advertises capabilities the canonical feature registry marks as planned. The article should not be rewritten around those inaccurate claims; the linked product page should be corrected.

## Blocking revision

1. **Correct the `/youtube-clipper` destination before publication, or temporarily use a truthful CTA destination.** The article's own Vidrial paragraph is accurate and deliberately excludes automatic tracking, multi-speaker layout, and sidecar-caption export from the Available list. The linked `src/components/youtube-clipper/public-page.tsx`, however, broadly promises that Vidrial “reframes the video” and explicitly says users can export SRT or VTT and include them in a batch. `src/domain/features/availability.ts` marks `subjectTracking`, `srtExport`, and `vttExport` as `planned`. The worker creating caption artifacts internally does not override that public feature-state source of truth.

## Evidence and quality checks

- **Intent:** Fully answers the procedural query. The target reader and eligible source types are explicit in the first two paragraphs.
- **Original usefulness:** The 0/1/2 context budget is a clear decision tool, and the worked webinar example demonstrates how it changes an actual candidate set.
- **Naturalness:** Calm, specific, and varied. No boilerplate AI introduction, inflated claims, fake anecdotes, or watchlist filler.
- **Time-sensitive YouTube claims:** Verified from current official Help pages on 2026-07-31. `https://support.google.com/youtube/answer/12779649?hl=en-GB` renders “Up to three minutes” and “square or vertical” for computer uploads. `https://support.google.com/youtube/answer/15424877?hl=en-GB` states that a Short over one minute with an active Content ID claim is blocked globally.
- **HEAD 404 resolution:** Both YouTube URLs return `404` to `HEAD` but `200` to a full redirected `GET`. Both also opened in Chrome with the expected English titles and article text. The failures from `scripts/check-blog-links.mjs` are checker limitations, not broken links; the checker should fall back to `GET` for a `HEAD` failure.
- **Other source alignment:** Adobe supports review, trim/extend, crop repair, further editing, and download; Descript supports 1–20 clips, 10 seconds to five minutes, layouts, optional criteria, and editable results; Vizard supports the source-density/yield warning; OpusClip supports topic and timeframe guidance.
- **External links:** All source URLs are reader-reachable. Descript blocks the command-line `GET` with `403` but renders in Chrome and contains the claimed controls.
- **Article product truth:** The only explicit Vidrial states match `src/domain/features/availability.ts`: caption correction and the final CTA's discovery/search/clarity/transcript/timeline features are Available; dynamic caption presets are Beta.
- **Internal links:** The two related article slugs and `/youtube-clipper` route exist. Publication still requires the related articles to become public PASS entries.
- **Corpus:** The exact-phrase audit reports no blocker or revision. Article 9 covers the broader operating system from source records through publication and results; this article remains distinguishable through AI candidate generation, context triage, boundary repair, and Shorts-specific platform checks. Keep future edits from making their H2 sequences converge further.
- **Metadata:** Schema and corpus validation pass; the 10-minute reading time matches the parser; title, description, keyword, summaries, and FAQs align with the body.

## Re-review condition

PASS once the product CTA destination uses the canonical feature states and the related-link publication constraint passes. No factual rewrite of the article body is otherwise required from this review.

## Re-review — 2026-07-31

**Final verdict: PASS.** This section supersedes the earlier REVISE decision.

- The `/youtube-clipper` destination now describes automatic tracking as available only when real tracking exists and explicitly says SRT/VTT sidecar export remains on the roadmap. It no longer promises SRT/VTT batch delivery or presents automatic subject tracking as an Available export step.
- The page's current crop choices—fit, fill, centre crop, manual focal point, and blurred background—do not claim the planned `subjectTracking` capability. Its caption entry promises correction and burned-in rendering, which is consistent with the article and canonical feature registry.
- The article body required no factual rewrite. Its current YouTube duration, aspect-ratio, and Content ID statements remain supported by official Help, and its Vidrial paragraph still uses only canonical Available and Beta states.

No editorial blocker remains. The normal release constraint still applies: the two related articles must be public PASS entries before this draft changes to public status.
