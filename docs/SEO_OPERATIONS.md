# Vidrial SEO operations

## Canonical and discovery endpoints

The production origin is `https://vidrial.vercel.app`.

- Sitemap index: `https://vidrial.vercel.app/sitemap.xml`
- Public-page sitemap: `https://vidrial.vercel.app/sitemap-pages.xml`
- Published-blog sitemap: `https://vidrial.vercel.app/sitemap-blog.xml`
- RSS: `https://vidrial.vercel.app/rss.xml`
- Robots: `https://vidrial.vercel.app/robots.txt`
- IndexNow proof: `https://vidrial.vercel.app/632573bd4c22eb026288a736579ebeba9bdb3b8480acee68dc7b47f0133eb2f2.txt`

Draft and non-PASS articles must never appear in discovery endpoints. Authenticated application, auth callback, account, design-system, parameterised-search, and API routes are excluded by an explicit public-page allowlist.

## Publication workflow

1. Research and draft in a controlled batch of three to ten.
2. Run `npm run content:validate`.
3. Have a reviewer who did not write the draft record PASS, REVISE, or REJECT.
4. Run `npm run content:audit` across the full corpus and resolve blockers.
5. Run `npm run content:links` close to publication; the checker falls back from `HEAD` to a browser-style `GET`, but rate limits and bot protection can still require manual verification.
6. Set `draft: false` only after PASS and final source checks.
7. Deploy and verify the canonical article returns HTTP 200 before notifying search engines.
8. Trigger a dry run with `npm run indexnow:trigger -- --reason=deploy`.
9. With `INDEXNOW_TRIGGER_SECRET` configured and the deployment live, execute `npm run indexnow:trigger -- --reason=deploy --execute`.
10. Check the persisted IndexNow result and retry state. A successful submission is discovery notification, not a promise that a search engine will index or rank the URL.

The first publication set should contain 15–20 strong, non-cannibalising articles. Publish three to five reviewed drafts per week after that. Recheck all time-sensitive facts on the actual publication date.

## Google Search Console

Google account authentication and site ownership are manual owner actions unless an authenticated owner browser session is available during verification.

1. Add the URL-prefix property `https://vidrial.vercel.app/`.
2. Choose HTML tag verification.
3. Store only the token value in `VITE_GOOGLE_SITE_VERIFICATION` and deploy.
4. Confirm the verification meta appears in the rendered homepage HTML.
5. Complete ownership verification in Search Console.
6. Submit `https://vidrial.vercel.app/sitemap.xml`.
7. Inspect the homepage, `/youtube-clipper`, `/blog`, and one published pillar article.
8. Request indexing for those key pages only. Do not manually submit all 60 URLs.

Review these Search Console views monthly:

- impressions, clicks, click-through rate, and average position;
- queries by page, country, and device;
- pages gaining impressions but earning weak CTR;
- queries sitting near page one where a better answer or title may help;
- indexed, crawled-not-indexed, discovered-not-indexed, duplicate, canonical, and robots issues;
- Core Web Vitals and mobile usability where reported.

Google's current documentation says a sitemap helps discovery but does not guarantee crawling or indexing. Generative AI use is not itself disqualifying; scaled pages without added reader value can violate spam policy. See [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview) and [Google generative-AI guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content).

## Bing Webmaster Tools

After Google ownership is verified:

1. Open Bing Webmaster Tools with the owner's Microsoft account.
2. Choose Import from Google Search Console and authorise the verified property.
3. Confirm the sitemap import and the canonical host.
4. Open the IndexNow activity view and confirm recent Vidrial submissions.
5. Test `robots.txt` and run Site Scan.
6. Review impressions, clicks, keywords, crawl errors, sitemap status, and IndexNow failures monthly.

Bing recommends IndexNow for automated notification of new, updated, and deleted URLs. It does not guarantee selection for the index. See [Bing IndexNow setup](https://www.bing.com/indexnow/IndexNowView/IndexNowGetStartedView) and [Bing URL submission guidance](https://www.bing.com/webmasters/help/url-submission-62f2860b).

DuckDuckGo and Yahoo do not require a separate 60-page submission campaign. Maintain crawlability, Bing coverage, IndexNow, canonical URLs, and useful internal links.

## Analytics consent and verification

GA4 uses the public measurement ID in `VITE_GA_MEASUREMENT_ID`. This identifier is not a secret. The analytics runtime must remain consent-gated:

1. With no `vidrial.consent.v1` value, confirm that no request to `googletagmanager.com` or `google-analytics.com` occurs.
2. Accept optional analytics and confirm the tag loads, advertising consent remains denied, and one route-level `page_view` is queued.
3. Open `/cookies`, choose **Change cookie settings**, then choose **Only necessary**.
4. Confirm `ga-disable-{measurement-id}` is true and the consent update denies analytics/ad storage.
5. Validate one consented visit in GA4 Realtime after deployment. Do not generate artificial traffic at scale.

The default implementation sends route page views and the existing allowlisted product/blog events. It must never include secrets, raw access tokens, private source URLs, transcripts, filenames, or other private media metadata.

Microsoft Clarity is deferred until a project is deliberately created. If enabled later, use [Clarity Consent V2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2) and keep analytics/ad storage denied before explicit consent.

## Current provider architecture

- Yahoo says its algorithmic search results are generated by Microsoft Bing.
- DuckDuckGo says traditional links and images are largely sourced from Bing, alongside DuckDuckBot and its own indexes.
- Brave documents crawler/refetch behavior but no general webmaster add-site console.
- Yandex Webmaster and Naver Search Advisor have separate ownership and sitemap workflows; use them when those markets are in scope.
- Baidu registration is a separate China-market/account workstream.

Do not buy paid SEO subscriptions merely to satisfy a registration checklist. Introduce Ahrefs, Semrush, or another paid stack only when its data is needed and an owner has approved the spend.

## Monthly editorial review

- Compare organic clicks, impressions, CTR, and average position with the previous month and the same period where seasonality matters.
- Review top queries per article. Update the page when the visible search intent differs from the draft's intended job.
- Inspect low-CTR pages before changing titles. Make sure the title promises exactly what the article delivers.
- Recheck platform limits, formats, prices, free tiers, watermarks, integrations, and policy claims.
- Refresh the checked date on comparison articles after reviewing official sources.
- Resolve broken external links and redirect chains.
- Review helpful/not-helpful feedback by article without attempting to identify anonymous readers.
- Find two pages targeting the same intent and consolidate or reposition them instead of adding another near-duplicate.
- Compare new drafts against the entire corpus for repeated openings, heading templates, FAQs, and five-word phrase overlap.
- Add internal links only when the destination helps the reader take the next step.
- Update older useful pages before publishing more pages into a weak cluster.
- Record changes in the article's `updatedAt` and `reviewedAt` fields; do not change dates without a meaningful review.

## Incident and rollback

If a draft leaks into a sitemap, a canonical points off-origin, structured data contains the wrong identity/date, or an article publishes unsupported product claims:

1. Revert the article to `draft: true` or revert the faulty platform change.
2. Deploy and verify the URL/discovery output.
3. Reconcile IndexNow with reason `delete` or `update` as appropriate.
4. Use Search Console removal only when urgent removal is justified; do not use it as a normal publishing control.
5. Record the cause and add a validator/reviewer check that prevents recurrence.

## Current verification boundary

Code, tests, local browser checks, and a production build can be verified without search-console credentials. Google/Bing ownership, sitemap acceptance, IndexNow production activity, URL inspection, and indexing status are complete only when directly observed in the authenticated consoles after deployment.
