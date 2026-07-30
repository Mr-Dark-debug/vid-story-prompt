# Vidrial Blog and SEO Content System Design

## Status

Approved for autonomous implementation on 2026-07-31. The project owner supplied the editorial backlog, page requirements, technical SEO requirements, publication strategy, and reference imagery, then explicitly asked the implementation to proceed without additional design prompts.

## Outcome

Vidrial will gain a production blog at `/blog` that behaves like a first-class content product: fast build-backed article rendering, an editorial index, topic categories, article utilities, reader feedback, complete crawl/discovery endpoints, and a controlled 60-article research workflow. The implementation must make every published article useful on its own and must not ship scaled low-value content.

The canonical production origin is `https://vidrial.vercel.app`. SEO URL generation must never derive from `brand.domain`, which currently contains a different future-facing domain.

## Considered approaches

### Database-backed CMS

Store article content in Supabase and render it from database rows. This simplifies remote editing but adds a database read to every article request, makes build-time validation harder, and couples crawlable content to service availability. It conflicts with the requirement that article text not need a database call.

### MDX application modules

Compile each article as executable MDX. This allows embedded React components but increases the attack and maintenance surface, encourages bespoke presentation inside articles, and is unnecessary for the requested text-only editorial format.

### Build-validated Markdown (selected)

Store plain Markdown under `content/blog/`, parse strict frontmatter with Zod, and expose content through server-only repository functions. A validation command runs before development and production builds. This keeps prose portable, fails malformed content early, avoids runtime database reads, and keeps the article layout responsible for presentation.

## Content model

Every Markdown file contains:

- `title`, `slug`, `description`, `category`, `primaryKeyword`, `secondaryKeywords`, and `searchIntent`;
- `author`, `publishedAt`, `updatedAt`, `reviewedAt`, `readingTime`, and three to five `aiSummary` bullets;
- authoritative `sources` with titles, URLs, and optional checked dates;
- `related` article slugs;
- optional reader-focused FAQs;
- `draft` and editorial review status;
- Markdown body with one H1 supplied by the layout, so article files begin at H2.

Validation rejects missing fields, invalid URLs and dates, duplicate slugs, duplicate primary keywords, impossible related links, self-links, invalid heading hierarchy, missing published sources, and published articles that have not passed review. Reading time is checked against the actual word count rather than trusted blindly.

The neutral byline is `Vidrial Editorial Team`. No personal biography or credentials are invented. A later verified owner profile can replace it without changing the content model.

## Routes and page composition

The route family follows the repository's TanStack parent/index convention:

- `/blog` — editorial index with search, category filtering, featured, latest, all articles, and pagination;
- `/blog/$slug` — full article page or a true 404 for missing/draft slugs;
- `/blog/category/$category` — crawlable category landing page;
- `/sitemap.xml` — sitemap index;
- `/sitemap-pages.xml` — allowlisted public product/marketing pages only;
- `/sitemap-blog.xml` — published articles and category pages;
- `/rss.xml` — published article feed;
- `/robots.txt` — crawl rules and sitemap reference;
- `/{INDEXNOW_KEY}.txt` — IndexNow key proof;
- protected server endpoints for feedback and deployment-triggered IndexNow reconciliation.

All index and article interfaces render directly inside the shared `MarketingLayout`. Full-width page bands may extend to the viewport; readable text remains aligned to the same internal grid as the existing navigation. The reference images influence hierarchy, compact category navigation, two-column editorial rhythm, and footer continuity only. They are not reproduced as a browser mockup, nested white canvas, or image-driven card grid.

## Visual direction

The direction is calm editorial utility: near-white page canvas, Charcoal type, Cool dividers, Medium secondary text, and restrained Coral for selection, focus, and primary action. Manrope remains the licensed fallback. There are no article hero images, placeholder image frames, purple gradients, glass panels, or ornamental AI imagery.

The blog index opens with an asymmetrical masthead and a direct promise: practical guides for turning authorised long-form media into editable short clips. A compact search field and horizontally scrollable category rail sit in the page flow. Featured and latest stories use typography, numbering, rules, and subtle surface shifts—not stock imagery—to create hierarchy. Desktop cards form a two-column editorial grid; mobile becomes a single readable column without horizontal page overflow.

Article pages use a wide desktop reading grid: sticky table of contents, approximately 70-character prose column, and a small utility rail for share/feedback. On tablets and phones the rails collapse into the document flow. Focus rings, skip navigation, semantic landmarks, visible link states, minimum 44px controls, reduced-motion behavior, and keyboard operation are required.

## Article behavior

Each article provides breadcrumbs, category, title, deck, byline, dates, reading time, an `AI Summary` generated at authoring time, table of contents, Markdown body, cited sources, optional FAQs, a contextual Vidrial CTA, helpful/not-helpful voting, sharing, related articles, and previous/next navigation.

Sharing prefers the Web Share API when available and always provides Copy Link, LinkedIn, X, Reddit, and email fallbacks. Every target uses the canonical article URL. Analytics events contain only slug, category, action, and other fixed non-sensitive values; article text, source URLs, and user identifiers never enter analytics.

## Feedback and abuse controls

Supabase stores reader votes in `blog_feedback` with `id`, `article_slug`, nullable `user_id`, nullable `anonymous_session_hash`, constrained `vote`, and `created_at`/`updated_at`. Browser code creates a random anonymous session identifier and sends it only to a server function. The server hashes it before persistence and never stores raw IP addresses or the raw identifier.

Database constraints allow one effective vote per article/user or article/anonymous hash. Repeat voting updates the existing vote rather than adding rows. RLS prevents public enumeration. A security-definer RPC or server-only admin path performs bounded upserts after Zod validation and confirms that the slug is a currently published article. Server responses never expose aggregate vote data or identifiers.

## Technical SEO

Every article emits an absolute self-canonical, unique title and description, `index,follow`, Open Graph article metadata, Twitter metadata, `BlogPosting` JSON-LD, and `BreadcrumbList` JSON-LD. Dates come from validated frontmatter. Author and publisher use truthful organization identities. `mainEntityOfPage` and all structured-data URLs are absolute.

Authenticated, callback, utility, preview, parameterized-search, and design-system routes never enter sitemaps. Drafts and non-pass articles never enter article lists, RSS, internal-link recommendations, or sitemaps. Sitemap `lastmod` values use the article's validated update date. Existing `SoftwareApplication` structured data remains scoped to relevant product pages.

Google site-verification metadata is configurable and rendered only when set. Webmaster-console verification, sitemap submission, URL inspection, and indexing requests require the owner's authenticated browser session and are reported separately from code completion.

## IndexNow

The IndexNow key is a random protocol key exposed at its exact `.txt` URL. A server-only submission utility accepts canonical Vidrial URLs only, batches at most 10,000 URLs, and posts to `https://api.indexnow.org/indexnow`. It records URL, content fingerprint, reason, submission time, response status, attempt count, and retry state in Supabase.

A secret-protected deployment endpoint reconciles the current published URL/fingerprint set against the log, submits only created, meaningfully changed, or deleted URLs, and persists the result. It does not submit unchanged pages on every build. Local scripts can validate the payload without sending it and can trigger the protected endpoint when deployment credentials are configured.

## Editorial production and review

The 60 supplied assignments are the canonical backlog. Drafting happens in controlled batches of five to ten. Each assignment receives fresh query research, current primary documentation where relevant, ranking-page gap analysis, competitor material, and community evidence when it adds qualitative insight. Time-sensitive limits, prices, policies, and product capabilities receive a checked date and current source.

Draft agents do not publish. A separate reviewer grades factual correctness, source-to-claim alignment, originality, search-intent satisfaction, metadata, naturalness, duplicate prose, internal links, external-link health, and Vidrial product truth. Outcomes are `PASS`, `REVISE`, or `REJECT`; only `PASS` can set `draft: false`.

The initial launch contains 15–20 of the strongest non-cannibalising pages. The rest remain complete reviewed drafts for a three-to-five-per-week cadence. Corpus tooling flags duplicated openings, repeated paragraph/heading structures, duplicate FAQ answers, high phrase overlap, and competing primary keywords.

The editorial rule is not to cosmetically “humanize” prose or chase AI-detector scores. Each article must contribute a sourced workflow, decision rule, failure mode, verified comparison, worked example, or Vidrial-specific constraint that a commodity summary would omit.

## Error handling and fallbacks

- Malformed or inconsistent content fails validation and the build.
- Unknown and draft slugs return 404; they do not redirect to the blog index.
- Missing Supabase configuration leaves article reading and sharing operational and shows a non-deceptive feedback error.
- Share API failure falls back to explicit share links and Copy Link.
- IndexNow transient failures are logged as retryable; permanent validation failures are not retried blindly.
- Missing webmaster authentication is reported as a manual action, never as successful registration.

## Verification

Automated verification covers schema failures, content discovery, draft exclusion, categories, table-of-contents extraction, canonical and structured-data output, sitemap/RSS/robots XML/text, IndexNow batching and idempotency, feedback validation/upsert behavior, search/filter interactions, share URLs, article 404s, and analytics event safety.

The completion gate is format, lint, application typecheck, unit tests, production build, worker tests/typecheck where unchanged integration risk still warrants them, relevant Supabase integration tests, and Playwright coverage at desktop and mobile widths. A local production-like server is inspected in Chrome for `/blog`, multiple articles, a category, metadata, keyboard use, and responsive layout. Deployment and webmaster-console results are reported only when directly observed.
