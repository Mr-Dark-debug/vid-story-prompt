# Independent review: What Is an AI Video Clipper? Complete Guide for 2026

- Backlog ID: 1
- Article: `content/blog/what-is-an-ai-video-clipper.md`
- Research note: `content/research/what-is-an-ai-video-clipper.md`
- Reviewed: 2026-07-31
- Verdict: **PASS**

## Publication decision

This is a useful, natural category guide with a clear answer-first opening, a defensible reader, and a genuinely helpful evaluation method. The definition, six-job decomposition, limitations, and review-first workflow satisfy the query better than the common upload/generate/export pages reviewed for this search. It is not keyword-stuffed, does not imply hands-on testing, and does not promise virality.

It is not publication-ready yet because one factual product-documentation claim is absent from the article's recorded sources and the `/features` CTA currently contradicts the repository's canonical feature states.

## Blocking revisions

1. **Record the Vizard source that supports the boundary-repair claim.** Article line 95 says Vizard documents restoring words when an AI clip ends awkwardly. That claim is supported by Vizard's current official page, [How to extend and add more content to AI-generated clips](https://help.vizard.ai/en/articles/8984381-how-to-extend-and-add-more-content-to-ai-generated-clips), but that page is not in frontmatter or the research note. Add it with `checkedAt: "2026-07-31"`, or remove the Vizard-specific clause. The existing `How many clips can AI generate?` citation does not support this claim.
2. **Do not publish the `/features` CTA while that destination contradicts product truth.** The article correctly states that subject tracking, multi-speaker layouts, filler-word removal, SRT/VTT export, and B-roll are Coming soon. However, `src/routes/features.tsx` advertises B-roll search and placement as Available and caption sidecar export as Beta, while `src/domain/features/availability.ts` marks `bRoll`, `srtExport`, and `vttExport` as `planned`. Correct the destination or point the CTA at a product page that uses the canonical states.

## Evidence and quality checks

- **Intent:** Matches informational-commercial intent: definition, fit, limits, and a selection test before buying a tool.
- **Original usefulness:** The `approved clips per review hour` decision rule and the split between discovery quality and finishing effort add non-commodity value.
- **Naturalness:** Direct and varied prose. No generic AI-style opening or repeated watchlist filler. The two uses of “landscape” are literal aspect-ratio descriptions, not vague prose.
- **Product truth in the article:** Matches `src/domain/features/availability.ts`: moment discovery, prompt search, complete-thought, hook strength, standalone clarity, transcript editing, caption correction, and timeline rearrangement are Available; animated caption presets are Beta; the named adjacent capabilities are Coming soon.
- **Source alignment:** Adobe supports review, trim/extend, crop correction, and editing; Descript supports selection criteria, layouts, editable clips, 1–20 clips, and 10-second to five-minute ranges; Vizard supports the stated yield constraints and Spark Beta/access caveat; OpusClip supports topic/timeframe redirection; QVHighlights supports separating query relevance from saliency.
- **Links:** All six frontmatter sources were reachable on 2026-07-31. Descript returns `403` to the command-line checker but renders normally in Chrome and exposes the cited controls, so this is bot protection rather than a broken reader link.
- **Internal links:** Both related article slugs exist, and `/features` resolves. Publication must wait for the product-truth correction above and for related articles to be public PASS entries, as required by the content schema.
- **Corpus:** No duplicate title, description, primary keyword, opening, heading template, or high five-word overlap in the six-article corpus. Some evaluation concepts recur in article 5, but this article uses them appropriately as a buyer's category test.
- **Metadata:** Frontmatter validates, the 9-minute reading time matches the parser, dates and category are coherent, and `Vidrial Editorial Team` matches the schema and organization author emitted by `src/features/blog/seo.ts`.

## Re-review condition

PASS after the missing Vizard source is recorded (or the claim is removed), the CTA destination no longer contradicts canonical feature states, and the related-link publication constraint passes.

## Re-review — 2026-07-31

**Final verdict: PASS.** This section supersedes the earlier REVISE decision.

- The article frontmatter now records Vizard's official [boundary-extension documentation](https://help.vizard.ai/en/articles/8984381-how-to-extend-and-add-more-content-to-ai-generated-clips) with `checkedAt: "2026-07-31"`, and the research note records the same source. It directly supports the sentence about restoring words omitted at a generated clip boundary.
- `src/routes/features.tsx` now labels B-roll search and placement **Coming soon**. It no longer presents SRT/VTT sidecar export as Beta, and its caption entry accurately limits the Beta claim to animated presets. The destination is now consistent with `src/domain/features/availability.ts` for the blocker identified in the first review.
- No new factual, source, originality, intent, metadata, or product-state blocker was introduced by these fixes. The article retains the distinct `approved clips per review hour` buyer test and its accurate feature-state paragraph.

The remaining step is release coordination rather than an editorial revision: both related articles must be public PASS entries before this article changes to `draft: false`, as enforced by the content schema.
