# Independent review: How AI Finds the Best Moments in a Long Video

- Backlog ID: 5
- Article: `content/blog/how-ai-finds-video-highlights.md`
- Research note: `content/research/how-ai-finds-video-highlights.md`
- Reviewed: 2026-07-31
- Verdict: **PASS**

## Publication decision

The technical explanation is careful and accessible. It correctly separates moment retrieval, saliency ranking, and clip construction; labels its scoring example as conceptual; qualifies the transcript-assisted paper as one experiment rather than a universal product result; and treats vendor virality scoring as a vendor-defined forecast.

It needs revision before publication because one current-product claim is attached to the wrong source, the principal evaluation contribution substantially repeats article 1, and the `/features` CTA currently contradicts canonical Vidrial feature states.

## Blocking revisions

1. **Cite the actual OpusClip documentation for chronological ordering.** Article line 172 says OpusClip exposes both score and chronological order, but the recorded `About the result clips` page does not contain that fact. Current official support exists at [Can I view clip results in chronological order?](https://help.opus.pro/docs/article/clipanything-qa-13) and [Result Page Walkthrough](https://help.opus.pro/docs/article/get-clips-faq-1). Add one of those sources with `checkedAt: "2026-07-31"` and align the sentence to it.
2. **Differentiate the evaluation section from article 1.** Article 1 already makes `approved clips per review hour`, candidate recall, boundary repair, duplicate/review load, and finishing effort its non-commodity evaluation method. Lines 192–204 repeat essentially the same contribution here. Keep this article's technical focus by explaining highlight-specific evaluation more distinctly—for example, the difference between relevant-moment recall, ranking quality, temporal overlap/boundary quality, and editorial approval—then translate those measures to review workload without reusing article 1's full buyer test.
3. **Do not publish the `/features` CTA while that destination contradicts product truth.** The article correctly says subject tracking and multi-speaker layouts are planned. `src/routes/features.tsx` nevertheless advertises B-roll search/placement as Available and caption sidecar export as Beta, while the canonical registry marks B-roll and SRT/VTT export planned. Correct the destination or use a truthful product page.

## Evidence and quality checks

- **Intent:** Matches the informational query and leads with the mechanism and central limitation.
- **Technical sources:** QVHighlights directly supports separate annotations for query-relevant moments and saliency. Highlight-CLIP is a CVPR Workshops paper using a pretrained multimodal encoder for highlight detection. The transcript-assisted arXiv paper reports better results in its own experiments when transcript and visual information are combined than with visual-only input.
- **Vendor sources:** Vizard's current Spark page documents visual, audio, sentiment/sound-cue, and prompt analysis, calls access a Beta testing phase, and says some users may not have access. OpusClip's virality-score page documents hook, flow, value, trend, prompt relevance, and score ordering; its result guidance supports topic/timeframe redirection. Vizard's clip-count page supports the source-density and suitability caveat.
- **Link status:** All seven frontmatter URLs returned `200` on full `GET` except no reader-facing failure: the CVF HTML URL returned `200` through `curl` and appears in current web search, even though one web extraction call reported an internal parser error. It is not a broken source.
- **Naturalness:** Specific and editorially judged, with varied section shapes and no generic AI-style opening or watchlist filler.
- **Product truth in the article:** The Available and planned Vidrial states match `src/domain/features/availability.ts`; the article does not turn highlight strength into a performance guarantee.
- **Internal links:** Both related article slugs and `/features` exist. Publication must also wait until related targets are public PASS entries.
- **Corpus:** Automated audit found no duplicate opening, primary keyword, heading template, or high phrase overlap. The evaluation concept duplication described above is semantic rather than copied prose and still needs editorial correction.
- **Metadata:** Schema validates; title, description, query intent, summaries, FAQs, dates, and the 10-minute reading time align with the article.

## Re-review condition

PASS after the chronological-order source is corrected, the evaluation contribution is differentiated from article 1, the CTA destination no longer contradicts canonical product states, and related-link publication validation passes.

## Re-review — 2026-07-31

**Final verdict: PASS.** This section supersedes the earlier REVISE decision.

- The article frontmatter and research note now record OpusClip's official [chronological-order documentation](https://help.opus.pro/docs/article/clipanything-qa-13) with `checkedAt: "2026-07-31"`. That page directly supports the current statement that the same candidates can be reviewed by score or chronology.
- The evaluation section has been rewritten around five highlight-system failure layers: retrieval recall, ranking quality, temporal boundaries, shortlist diversity, and standalone/editorial approval. It now diagnoses where a system failed instead of repeating article 1's `approved clips per review hour` buyer test, repair-time table, and full purchase evaluation.
- `src/routes/features.tsx` now marks B-roll Coming soon and no longer promotes caption sidecar export as Beta. The article's Available highlight signals and planned subject-tracking/multi-speaker boundary therefore match the linked destination for the previously identified blocker.
- The revised section remains supported by QVHighlights' separation of query relevance and saliency, while its boundary, diversity, and editorial-approval checks are clearly presented as an evaluation framework rather than invented benchmark results.

No factual or editorial blocker remains. Coordinated publication must still make both related targets public PASS entries before setting this article to `draft: false`.
