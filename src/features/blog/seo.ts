import type { BlogArticleMeta } from "@/features/blog/schema";
import {
  absoluteUrl,
  pageMeta,
  SEO_EDITORIAL_AUTHOR,
  SEO_SITE_NAME,
  serializeJsonLd,
} from "@/config/seo";
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
  const title = `${article.title} | ${SEO_SITE_NAME}`;
  const base = pageMeta({
    title,
    description: article.description,
    path: article.canonicalPath,
    type: "article",
  });

  return {
    meta: [
      ...base.meta,
      { name: "author", content: SEO_EDITORIAL_AUTHOR },
      { property: "article:published_time", content: article.publishedAt },
      { property: "article:modified_time", content: article.updatedAt },
      { property: "article:section", content: article.category },
    ],
    links: base.links,
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

export { serializeJsonLd };
