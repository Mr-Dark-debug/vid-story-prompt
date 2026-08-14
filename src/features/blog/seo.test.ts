import { describe, expect, it } from "vitest";

import type { BlogArticleMeta } from "@/features/blog/schema";
import { absoluteUrl, SEO_ORIGIN, verificationMeta } from "@/config/seo";
import {
  articleMeta,
  blogPostingJsonLd,
  breadcrumbJsonLd,
  serializeJsonLd,
} from "@/features/blog/seo";

const article: BlogArticleMeta = {
  title: 'A safer </script><script>alert("x")</script> guide',
  slug: "safer-guide",
  description: "A practical guide to safe & useful clips.",
  category: "AI Video Clipping",
  primaryKeyword: "ai video clipper",
  secondaryKeywords: ["long video to shorts"],
  searchIntent: "informational-commercial",
  author: "Vidrial Editorial Team",
  publishedAt: "2026-07-20",
  updatedAt: "2026-07-30",
  reviewedAt: "2026-07-30",
  readingTime: 8,
  aiSummary: ["One", "Two", "Three"],
  sources: [{ title: "Source", url: "https://example.com/source" }],
  related: [],
  faqs: [{ question: "Is this safe?", answer: "Read the constraints." }],
  draft: false,
  reviewStatus: "PASS",
  featured: true,
  canonicalPath: "/blog/safer-guide",
  wordCount: 1_750,
  headings: [{ level: 2, text: "Start here", id: "start-here" }],
  excerpt: "A practical guide.",
};

describe("canonical SEO helpers", () => {
  it("joins canonical URLs against the fixed HTTPS production origin", () => {
    expect(SEO_ORIGIN).toBe("https://vidrial.vercel.app");
    expect(absoluteUrl("/blog/safer-guide")).toBe("https://vidrial.vercel.app/blog/safer-guide");
    expect(() => absoluteUrl("https://example.com/elsewhere")).toThrow(/Canonical URL/);
  });

  it("omits blank verification metadata", () => {
    expect(verificationMeta({ google: "", bing: "   " })).toEqual([]);
    expect(verificationMeta({ google: "google-token", bing: "bing-token" })).toEqual([
      { name: "google-site-verification", content: "google-token" },
      { name: "msvalidate.01", content: "bing-token" },
    ]);
  });
});

describe("article SEO helpers", () => {
  it("emits an absolute self-canonical and complete article metadata", () => {
    const head = articleMeta(article);

    expect(head.links).toContainEqual({
      rel: "canonical",
      href: "https://vidrial.vercel.app/blog/safer-guide",
    });
    expect(head.meta).toContainEqual({ name: "robots", content: "index,follow" });
    expect(head.meta).toContainEqual({
      property: "article:published_time",
      content: "2026-07-20",
    });
    expect(head.meta).toContainEqual({
      property: "article:modified_time",
      content: "2026-07-30",
    });
  });

  it("uses truthful organization identities and accurate article values", () => {
    const jsonLd = blogPostingJsonLd(article);

    expect(jsonLd.author).toEqual({
      "@type": "Organization",
      name: "Vidrial Editorial Team",
    });
    expect(jsonLd.publisher).toEqual({
      "@type": "Organization",
      name: "Vidrial",
      logo: {
        "@type": "ImageObject",
        url: "https://vidrial.vercel.app/favicon.svg",
      },
    });
    expect(jsonLd.datePublished).toBe("2026-07-20");
    expect(jsonLd.dateModified).toBe("2026-07-30");
    expect(jsonLd.mainEntityOfPage).toEqual({
      "@type": "WebPage",
      "@id": "https://vidrial.vercel.app/blog/safer-guide",
    });
    expect(JSON.stringify(jsonLd)).not.toContain("FAQPage");
  });

  it("creates an absolute breadcrumb trail", () => {
    const jsonLd = breadcrumbJsonLd(article);
    expect(jsonLd.itemListElement.map((item) => item.item)).toEqual([
      "https://vidrial.vercel.app/",
      "https://vidrial.vercel.app/blog",
      "https://vidrial.vercel.app/blog/category/ai-video-clipping",
      "https://vidrial.vercel.app/blog/safer-guide",
    ]);
  });

  it("escapes script-breaking characters when serializing JSON-LD", () => {
    const serialized = serializeJsonLd(blogPostingJsonLd(article));

    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(serialized).headline).toBe(article.title);
  });
});
