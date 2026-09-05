import { absoluteUrl, SEO_SITE_NAME } from "@/config/seo";
import { blogCategorySlug } from "@/features/blog/category";
import { getPublishedArticles } from "@/features/blog/repository.server";
import type { BlogArticleMeta } from "@/features/blog/schema";

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";
const CACHE_CONTROL = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

/** Explicitly indexable product, marketing, and public documentation routes. */
export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/features",
  "/how-it-works",
  "/pricing",
  "/youtube-clipper",
  "/use-cases",
  "/use-cases/courses",
  "/use-cases/podcasts",
  "/use-cases/product-demos",
  "/use-cases/short-form",
  "/use-cases/youtube",
  "/docs",
  "/docs/exporting",
  "/docs/getting-started",
  "/docs/uploading-media",
  "/security",
  "/ai-transparency",
  "/roadmap",
  "/changelog",
  "/contact",
  "/privacy",
  "/terms",
  "/cookies",
  "/acceptable-use",
  "/copyright",
  "/imprint",
] as const;

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function textResponse(body: string, contentType: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "cache-control": CACHE_CONTROL,
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    },
  });
}

function xmlResponse(body: string, contentType = "application/xml; charset=utf-8"): Response {
  return textResponse(body, contentType);
}

function isPublicArticle(article: BlogArticleMeta): boolean {
  return !article.draft && article.reviewStatus === "PASS";
}

function publicArticles(articles: readonly BlogArticleMeta[]): BlogArticleMeta[] {
  const unique = new Map<string, BlogArticleMeta>();

  for (const article of articles) {
    if (isPublicArticle(article)) unique.set(article.canonicalPath, article);
  }

  return [...unique.values()].sort((left, right) =>
    left.canonicalPath.localeCompare(right.canonicalPath, "en"),
  );
}

export function toCategorySlug(category: string): string {
  return blogCategorySlug(category);
}

export function sitemapIndexResponse(): Response {
  const locations = [absoluteUrl("/sitemap-pages.xml"), absoluteUrl("/sitemap-blog.xml")];
  const entries = locations
    .map((location) => `  <sitemap><loc>${xmlEscape(location)}</loc></sitemap>`)
    .join("\n");

  return xmlResponse(
    `${XML_DECLARATION}\n<sitemapindex xmlns="${SITEMAP_NAMESPACE}">\n${entries}\n</sitemapindex>\n`,
  );
}

export function pagesSitemapResponse(): Response {
  const entries = PUBLIC_SITEMAP_PATHS.map(
    (path) => `  <url><loc>${xmlEscape(absoluteUrl(path))}</loc></url>`,
  ).join("\n");

  return xmlResponse(
    `${XML_DECLARATION}\n<urlset xmlns="${SITEMAP_NAMESPACE}">\n${entries}\n</urlset>\n`,
  );
}

export function blogSitemapResponse(
  articles: readonly BlogArticleMeta[] = getPublishedArticles(),
): Response {
  const published = publicArticles(articles);
  const newestArticleDate = published.reduce<string | undefined>(
    (newest, article) => (!newest || article.updatedAt > newest ? article.updatedAt : newest),
    undefined,
  );
  const categoryDates = new Map<string, string>();

  for (const article of published) {
    const categorySlug = toCategorySlug(article.category);
    const current = categoryDates.get(categorySlug);
    if (!current || article.updatedAt > current) categoryDates.set(categorySlug, article.updatedAt);
  }

  const urls: Array<{ location: string; lastModified?: string }> = [
    { location: absoluteUrl("/blog"), lastModified: newestArticleDate },
    ...[...categoryDates.entries()].map(([slug, lastModified]) => ({
      location: absoluteUrl(`/blog/category/${slug}`),
      lastModified,
    })),
    ...published.map((article) => ({
      location: absoluteUrl(article.canonicalPath),
      lastModified: article.updatedAt,
    })),
  ].sort((left, right) => left.location.localeCompare(right.location, "en"));

  const entries = urls
    .map(
      ({ location, lastModified }) =>
        `  <url><loc>${xmlEscape(location)}</loc>${lastModified ? `<lastmod>${xmlEscape(lastModified)}</lastmod>` : ""}</url>`,
    )
    .join("\n");

  return xmlResponse(
    `${XML_DECLARATION}\n<urlset xmlns="${SITEMAP_NAMESPACE}">\n${entries}\n</urlset>\n`,
  );
}

function rssDate(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toUTCString();
}

export function rssResponse(
  articles: readonly BlogArticleMeta[] = getPublishedArticles(),
): Response {
  const published = publicArticles(articles).sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt, "en") ||
      left.canonicalPath.localeCompare(right.canonicalPath, "en"),
  );
  const newestDate = published.reduce<string | undefined>(
    (newest, article) => (!newest || article.updatedAt > newest ? article.updatedAt : newest),
    undefined,
  );
  const items = published
    .map((article) => {
      const canonical = absoluteUrl(article.canonicalPath);
      return [
        "    <item>",
        `      <title>${xmlEscape(article.title)}</title>`,
        `      <link>${xmlEscape(canonical)}</link>`,
        `      <guid isPermaLink="true">${xmlEscape(canonical)}</guid>`,
        `      <description>${xmlEscape(article.description)}</description>`,
        `      <category>${xmlEscape(article.category)}</category>`,
        `      <pubDate>${rssDate(article.publishedAt)}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const lastBuildDate = newestDate
    ? `\n    <lastBuildDate>${rssDate(newestDate)}</lastBuildDate>`
    : "";
  const body = [
    XML_DECLARATION,
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${SEO_SITE_NAME} Blog</title>`,
    `    <link>${xmlEscape(absoluteUrl("/blog"))}</link>`,
    `    <description>Practical guides for turning long-form media into editable short clips.</description>`,
    `    <language>en</language>${lastBuildDate}`,
    `    <atom:link href="${xmlEscape(absoluteUrl("/rss.xml"))}" rel="self" type="application/rss+xml" />`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return xmlResponse(body, "application/rss+xml; charset=utf-8");
}

export function robotsResponse(): Response {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /app/",
    "Disallow: /api/",
    "Disallow: /auth/",
    "",
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");

  return textResponse(body, "text/plain; charset=utf-8");
}
