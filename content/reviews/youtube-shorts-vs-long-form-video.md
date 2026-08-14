# Independent review: YouTube Shorts vs Long-Form Video: How to Use Both Together

- Backlog ID: 20
- Article: `content/blog/youtube-shorts-vs-long-form-video.md`
- Research note: `content/research/youtube-shorts-vs-long-form-video.md`
- Reviewed: 2026-07-31
- Verdict: **PASS**

## Publication decision

The article's core strategy is strong and current. It gives Shorts and long-form distinct jobs, makes the same-channel decision about audience fit rather than algorithm folklore, builds standalone topic pairs, uses the native Related Video bridge, and measures the two format funnels separately.

Publication is blocked by one broken external source URL. No prose or product-truth revision is otherwise required.

## Blocking revision

1. **Replace or remove the dead Sprout Social source.** `https://sproutsocial.com/insights/youtube-shorts-vs-long-form/` currently returns `404`, and `npm run content:links` attributes the only corpus link failure to this frontmatter source. Replace it with a current, directly relevant Sprout page and update the research note, or remove it if no article claim depends on it. Do not leave a dead source in a publishable reference list.

## Evidence and quality checks

- **Format interaction:** YouTube's current Shorts discovery page explicitly says Shorts performance does not negatively affect long-form recommendations. The article accurately distinguishes that platform fact from the separate possibility of weak audience overlap.
- **Performance comparison:** YouTube's current performance FAQ supports the qualified statement that relative watch time generally matters more for shorter videos and absolute watch time generally matters more for longer videos. The article does not compare raw percentage viewed across formats as if it were a fair contest.
- **Related Video and link behavior:** Current YouTube upload documentation supports Related Video with advanced feature access, same-channel public/unlisted videos, Shorts, or live streams. Current link guidance confirms ordinary Shorts-description and comment URLs are non-clickable. The article explains both correctly.
- **Audience analytics:** Current Audience documentation supports monthly audience as an estimate of active audience, new/casual/regular segments, and the Formats your viewers watch report. The measurement section does not equate subscriber count with an active cohort.
- **Original usefulness:** The two-depth rule, topic-pair contract, five-part extraction test, publishing-order decision, two-funnel-plus-bridge model, and crossover diagnostic form a clear operating framework beyond a generic format comparison.
- **Naturalness:** The draft uses concrete microphone and podcast examples, acknowledges when the reverse publishing order makes sense, and avoids presenting Shorts as universally superior reach inventory.
- **Product truth:** Available YouTube ingestion, moment suggestions, prompt search, transcript/caption correction, timeline editing, and MP4 export are stated narrowly. Subject tracking and multi-speaker layouts are correctly labelled Coming soon.
- **Internal links:** Both related slugs and `/youtube-clipper` exist and are contextually earned. Their search and cadence intents do not duplicate this cross-format strategy.
- **Corpus:** `npm run content:audit` reports zero blockers and zero revisions. No opening, heading-template, keyword, or high-overlap conflict was detected across the 18-article corpus.
- **Metadata:** Schema validation passes. The title, description, summaries, four FAQs, dates, ten recorded sources, two related slugs, and nine-minute reading time align with the 1,720-word body.

## Re-review condition

PASS after the dead Sprout Social source is replaced with a working, claim-aligned page or removed from both the article frontmatter and research note, `npm run content:links` passes, and the two related targets are coordinated for public release.

## Re-review — 2026-07-31

The dead Sprout Social source was removed from both frontmatter and the research note because no factual article claim depended on it. The remaining official and current sources support the published claims, and the related trio is being released together. **Final verdict: PASS.**
