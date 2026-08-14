import type { BlogArticleMeta } from "@/features/blog/schema";
import { absoluteUrl, SEO_EDITORIAL_AUTHOR, SEO_SITE_NAME } from "@/config/seo";
import { blogCategorySlug } from "@/features/blog/category";

const publisher = {
  "@type": "Organization",
  name: SEO_SITE_NAME,
  logo: {
    "@type": "ImageObject",
    url: absoluteUrl("/favicon.svg"),
  },
} as const;

const author = {
  "@type": "Organization",
  name: SEO_EDITORIAL_AUTHOR,
} as const;

export function articleMeta(article: BlogArticleMeta) {
  const canonical = absoluteUrl(article.canonicalPath);
  const title = `${article.title} | ${SEO_SITE_NAME}`;

  return {
    meta: [
      { title },
      { name: "description", content: article.description },
      { name: "author", content: SEO_EDITORIAL_AUTHOR },
      { name: "robots", content: "index,follow" },
      { property: "og:site_name", content: SEO_SITE_NAME },
      { property: "og:title", content: title },
      { property: "og:description", content: article.description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: canonical },
      { property: "article:published_time", content: article.publishedAt },
      { property: "article:modified_time", content: article.updatedAt },
      { property: "article:section", content: article.category },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: article.description },
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}

export function blogPostingJsonLd(article: BlogArticleMeta) {
  const canonical = absoluteUrl(article.canonicalPath);

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author,
    publisher,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },
    url: canonical,
    articleSection: article.category,
    keywords: [article.primaryKeyword, ...article.secondaryKeywords],
    wordCount: article.wordCount,
  };
}

export function breadcrumbJsonLd(article: BlogArticleMeta) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: absoluteUrl("/blog"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.category,
        item: absoluteUrl(`/blog/category/${blogCategorySlug(article.category)}`),
      },
      {
        "@type": "ListItem",
        position: 4,
        name: article.title,
        item: absoluteUrl(article.canonicalPath),
      },
    ],
  };
}

/** Serialize structured data safely for an inline application/ld+json script. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
