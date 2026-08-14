# Vidrial blog editorial standard

## The test that matters

Do not write “SEO content.” Answer the query better than the useful pages already ranking.

A publishable Vidrial article gives a creator something they can decide, check, or do. It earns its length through sourced specifics, practical judgment, real constraints, and examples. It does not earn publication by hitting a word count, repeating the keyword, or passing an AI detector.

## Publication gate

An article can pass only when all of these are true:

1. The first paragraph answers the question or frames the decision. It does not warm up with generic claims about how important video has become.
2. The reader is clear: the draft says who the workflow is for and what they will be able to do or decide.
3. The article contributes at least one non-commodity element: an original workflow, decision rule, verified comparison, failure mode, worked example, or Vidrial-specific product constraint.
4. Every time-sensitive platform limit, price, feature, format, size, or policy has a current primary source and a checked date.
5. No sentence implies testing, experience, quotes, statistics, credentials, or Vidrial capabilities that do not exist.
6. Vidrial features use the exact states Available, Beta, or Coming soon from the product truth sources.
7. Each section advances the reader's task. Delete a section that merely restates the title, the previous section, or common knowledge.
8. Concrete nouns and verbs replace vague praise. Explain the behavior, number, constraint, failure, or trade-off instead of calling something powerful, seamless, robust, or transformative.
9. Headings follow the query. The 60 articles must not share one universal outline.
10. Paragraphs contain one point, but their length and cadence can vary naturally. Lists are for genuinely parallel items, not a way to turn every thought into a template.
11. Limitations appear next to benefits. Do not hide watermarks, free-plan limits, unsupported formats, review steps, or failure cases.
12. The ending gives the next decision or action. It does not recap the entire article or announce that the future is bright.
13. Internal links are earned by context. Anchor text describes what the destination helps the reader do.
14. A reviewer who did not write the draft checks factuality, source-to-claim alignment, intent, originality, naturalness, links, and duplication across the full corpus.

## Voice

Write like an experienced creator or editor explaining a workflow to another creator: direct, calm, specific, and willing to say where the method breaks. Use contractions when they sound natural. A short aside is fine when it clarifies judgment.

Do not manufacture humanity. Do not insert typos, slang, fake anecdotes, fake opinions, arbitrary jokes, or forced sentence fragments to “beat” a detector. Human-sounding work comes from having a real point, not cosmetic noise.

Use the words readers use. Prefer short familiar words to inflated alternatives. Address the reader as “you” when giving instructions. Lead with the important part. Split a long sentence when it carries two decisions.

## AI-prose review watchlist

The following words and structures are review prompts, not banned words:

- delve or dive into;
- landscape, realm, tapestry, navigate;
- robust, seamless, pivotal, crucial, profound, transformative;
- additionally, moreover;
- “in a world where”;
- “it's important to note”;
- “when it comes to”;
- “not only … but also”;
- “paving the way”;
- “in conclusion” or “in summary.”

Keep a precise use. Rewrite a vague or repetitive use with the actual behavior or delete it. A useful sentence should not remain equally plausible after swapping its topic nouns for a completely different industry.

Also check structural cues:

- a generic first paragraph that could open any article;
- mechanically identical H2/H3 patterns across drafts;
- unusually even paragraph lengths;
- lists where prose would explain the relationship better;
- overly formal, uniformly clean narration with no editorial judgment;
- invented quotations that sound like the narrator;
- repetitive optimistic conclusions;
- benefits separated from their constraints;
- redundant definitions and “why this matters” sections that say nothing new.

## Research standard

For every article:

1. Search the primary query and identify the dominant intent.
2. Read current official platform or standards documentation where it applies.
3. Review at least three strong results to identify consensus, disagreement, and missing detail.
4. Read current competitor documentation when a product or workflow is discussed.
5. Use Reddit or other communities for qualitative pain points, never as the authority for a factual limit.
6. Record the useful sources and the checked date in the research note and frontmatter.
7. Identify the one contribution that makes this article more useful than a commodity summary before drafting.

Comparison and “best” articles require evidence for the decision factors, benefits, and drawbacks. If Vidrial did not run a hands-on test, the article must say it is a documentation-based comparison and must not use “tested” in a way that implies otherwise. Prices and features must include the line `Pricing and features checked on 2026-07-31.` and must be rechecked before publication if the date changes.

## Product truth

Before accepting a Vidrial claim, check:

- `src/domain/features/availability.ts`;
- `src/domain/clipping/entitlements.ts`;
- `src/domain/connectors/registry.ts`;
- `PRODUCT_SPEC.md`;
- current marketing and product routes.

In particular, filler-word removal, subject tracking, multi-speaker layouts, SRT/VTT export, and B-roll are not generally available. Dynamic caption presets and long-silence removal are Beta. Do not let a topic title turn a planned Vidrial capability into a product claim.

## Review outcomes

- `PASS`: the article can publish after corpus and link checks.
- `REVISE`: the topic is useful, but one or more blocking issues have a specific fix.
- `REJECT`: the premise is unsupported, cannibalises another page, cannot be made accurate, or lacks enough user value to justify a separate URL.

AI-detector scores never determine these outcomes. OpenAI withdrew its own classifier for low accuracy, and research shows detector performance degrades under editing and mixed authorship. Review the work, the evidence, and the value to the reader instead.

## Sources behind this standard

- [Google: guidance on generative AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)
- [Google: creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google: AI features and your website](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Google: writing high-quality reviews](https://developers.google.com/search/docs/specialty/ecommerce/write-high-quality-reviews)
- [ACL 2025: human detection of AI-generated non-fiction](https://aclanthology.org/2025.acl-long.267/)
- [ACL 2025: limits of fixed AI-vocabulary lists](https://aclanthology.org/2025.bea-1.71/)
- [ACL 2024: detector fragility under real-world attacks and mixed authorship](https://aclanthology.org/2024.acl-long.160/)
- [OpenAI: retired AI-text classifier](https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text/)
- [GOV.UK clear-language guidance](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)
- [Digital.gov plain-language principles](https://digital.gov/guides/plain-language/principles/short-simple)
- [Microsoft writing style](https://learn.microsoft.com/en-us/windows/apps/design/style/writing-style)
