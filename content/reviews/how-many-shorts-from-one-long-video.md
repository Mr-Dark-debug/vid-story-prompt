# Independent review: How Many Shorts Can You Make From One Long Video?

- Backlog ID: 7
- Article: `content/blog/how-many-shorts-from-one-long-video.md`
- Research note: `content/research/how-many-shorts-from-one-long-video.md`
- Reviewed: 2026-07-31
- Verdict: **REVISE**

## Publication decision

The article answers the estimation query directly and refuses the misleading minutes-to-clips ratios common in this result set. Its distinction between candidates, approved edits, and publishable clips is useful; the five-gate yield model, sample audit, rejection ledger, and hypothetical 11-to-four example give a creator a workable planning method without presenting a benchmark as evidence.

The article body is accurate, natural, and well supported. Publication is blocked only by its contextual `/use-cases/short-form` destination, which still presents Beta work as an unqualified outcome.

## Blocking revision

1. **Correct the `/use-cases/short-form` destination or temporarily use a product page with canonical states.** The article accurately labels moment discovery, prompt search, complete-thought and standalone-clarity signals, transcript editing, caption correction, and timeline rearrangement as Available. The linked route promises “Caption presets tuned for mobile” and offers “Add bold captions safe for 9:16” as a working prompt without a Beta label, while `src/domain/features/availability.ts` marks animated caption presets and brand colours Beta. It also presents three vertical drafts as a routine outcome without separating the available selection/editor controls from Beta aspect-ratio adaptation. A reader following the CTA should not encounter a broader state claim than the article just made.

## Evidence and quality checks

- **Intent:** Fully matches the planning query. The answer distinguishes the number a tool generates from the number a team can responsibly publish.
- **Original usefulness:** The candidate/approved/published funnel and the context, difference, visual, and capacity gates are a non-commodity decision method. The beginning/middle/end audit is explicitly a diagnostic rather than a statistical forecast.
- **Naturalness:** Direct, varied prose with concrete editorial judgment. It has no generic importance preamble, inflated adjectives, fake anecdote, or repetitive optimistic conclusion.
- **Time-sensitive claims:** Current official YouTube Help still supports eligible square or vertical Shorts up to three minutes, the over-one-minute active-Content-ID global block, and Related Video access for channels with advanced features. The article dates those claims 2026-07-31 and treats the duration as a ceiling rather than a target.
- **Vendor-source alignment:** Descript currently documents a requested range of 1–20 clips; Vizard documents variable output based on speech, source length, duration, and suitability, including zero output; OpusClip documents model- and source-length-dependent result ranges. The article correctly describes these as generated output rather than publishable yield.
- **Accessibility source:** W3C supports the description of captions as synchronized speech and important audio information and notes that automatic captions often need editing.
- **Product truth:** The article's explicit Available list matches `src/domain/features/availability.ts`. It does not promise automatic tracking, multi-speaker layouts, filler-word removal, B-roll, or caption sidecars.
- **Internal links:** All linked routes and article slugs exist. The two related article targets must be public PASS entries in the same release before this draft can become public.
- **Corpus:** The automated audit reports no duplicate opening, heading template, or high phrase overlap. Article 9 covers the full operating workflow; this page remains distinct through yield estimation, stop rules, and capacity planning.
- **Metadata:** Frontmatter validates; title, description, primary keyword, summaries, FAQs, dates, and the 9-minute reading time match the body.

## Re-review condition

PASS once the short-form CTA destination labels canonical feature states or the article points to a truthful alternative, and once the related targets are coordinated as public PASS entries.

## Re-review — 2026-07-31

**Final verdict: PASS.** This section supersedes the earlier REVISE decision.

- `/use-cases/short-form` now says that aspect-ratio and caption tools are Beta in its lead. Its outcome list labels both “Three 9:16 drafts” as Beta aspect-ratio adaptation and “Caption presets tuned for mobile” as Beta.
- The destination no longer presents those outcomes as generally Available. Its hook-first positioning remains consistent with the Available discovery and hook-strength signals in `src/domain/features/availability.ts`.
- The article body required no factual rewrite. Its current Shorts duration, Content ID, Related Video, vendor-output, accessibility, and Vidrial Available-state claims remain supported by the sources and canonical product registry.

No editorial blocker remains. The normal release constraint still applies: the two related article targets must be public PASS entries before this draft changes to public status.
