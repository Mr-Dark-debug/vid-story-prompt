import { describe, expect, it } from "vitest";

import type { BlogArticleMeta } from "@/features/blog/schema";
import {
  blogSitemapResponse,
  pagesSitemapResponse,
  PUBLIC_SITEMAP_PATHS,
  robotsResponse,
  rssResponse,
  sitemapIndexResponse,
  toCategorySlug,
} from "@/features/blog/discovery.server";

function article(overrides: Partial<BlogArticleMeta> = {}): BlogArticleMeta {
  return {
    title: "How to create useful video clips",
    slug: "useful-video-clips",
    description: "A practical guide to finding and editing useful moments from long videos.",
    category: "AI Video Clipping",
    primaryKeyword: "useful video clips",
    secondaryKeywords: ["video clipping"],
    searchIntent: "informational",
    author: "Vidrial Editorial Team",
    publishedAt: "2026-07-20",
    updatedAt: "2026-07-29",
    reviewedAt: "2026-07-29",
    readingTime: 8,
    aiSummary: ["First useful point.", "Second useful point.", "Third useful point."],
    sources: [{ title: "Source", url: "https://example.com/source" }],
    related: [],
    faqs: [],
    draft: false,
    reviewStatus: "PASS",
    featured: false,
    canonicalPath: "/blog/useful-video-clips",
    wordCount: 1_500,
    headings: [{ level: 2, text: "Start here", id: "start-here" }],
    excerpt: "A practical guide.",
    ...overrides,
  };
}

async function parseXml(response: Response): Promise<Document> {
  const document = new DOMParser().parseFromString(await response.text(), "application/xml");
  expect(document.querySelector("parsererror")).toBeNull();
  return document;
}

function locations(document: Document): string[] {
  return [...document.querySelectorAll("loc")].map((node) => node.textContent ?? "");
}

describe("blog discovery responses", () => {
  it("creates a canonical sitemap index", async () => {
    const response = sitemapIndexResponse();
    const document = await parseXml(response);

    expect(response.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(locations(document)).toEqual([
      "https://vidrial.vercel.app/sitemap-pages.xml",
      "https://vidrial.vercel.app/sitemap-blog.xml",
    ]);
  });

  it("uses an explicit public-page allowlist without private or parameterized routes", async () => {
    const document = await parseXml(pagesSitemapResponse());
    const urls = locations(document);

    expect(urls).toHaveLength(PUBLIC_SITEMAP_PATHS.length);
    expect(urls.every((url) => url.startsWith("https://vidrial.vercel.app/"))).toBe(true);
    expect(urls.some((url) => /\/app(?:\/|$)/.test(url))).toBe(false);
    expect(urls.some((url) => /\/auth(?:\/|$)/.test(url))).toBe(false);
    expect(urls.some((url) => url.includes("?"))).toBe(false);
    expect(urls).not.toContain("https://vidrial.vercel.app/design-system");
  });

  it("excludes drafts and non-PASS articles and uses accurate lastmod dates", async () => {
    const document = await parseXml(
      blogSitemapResponse([
        article(),
        article({
          slug: "draft-guide",
          canonicalPath: "/blog/draft-guide",
          draft: true,
          reviewStatus: "REVISE",
        }),
        article({
          slug: "rejected-guide",
          canonicalPath: "/blog/rejected-guide",
          draft: true,
          reviewStatus: "REJECT",
        }),
      ]),
    );
    const urls = [...document.querySelectorAll("url")].map((node) => ({
      location: node.querySelector("loc")?.textContent,
      lastModified: node.querySelector("lastmod")?.textContent,
    }));

    expect(urls).toContainEqual({
      location: "https://vidrial.vercel.app/blog/useful-video-clips",
      lastModified: "2026-07-29",
    });
    expect(urls).toContainEqual({
      location: "https://vidrial.vercel.app/blog/category/ai-video-clipping",
      lastModified: "2026-07-29",
    });
    expect(urls.some(({ location }) => location?.includes("draft-guide"))).toBe(false);
    expect(urls.some(({ location }) => location?.includes("rejected-guide"))).toBe(false);
  });

  it("produces stable category slugs", () => {
    expect(toCategorySlug("Creator’s Workflow & Reframing")).toBe("creators-workflow-reframing");
  });

  it("creates valid escaped RSS from only published articles", async () => {
    const response = rssResponse([
      article({
        title: "Captions & <safe> clips",
        description: "A useful & accurate guide to captions.",
        category: "Captions & Transcripts",
      }),
      article({
        slug: "draft-guide",
        canonicalPath: "/blog/draft-guide",
        title: "Hidden draft",
        draft: true,
        reviewStatus: "REVISE",
      }),
    ]);
    const document = await parseXml(response);

    expect(response.headers.get("content-type")).toBe("application/rss+xml; charset=utf-8");
    expect(document.querySelector("channel > title")?.textContent).toBe("Vidrial Blog");
    expect(document.querySelector("item > title")?.textContent).toBe("Captions & <safe> clips");
    expect(document.querySelector("item > description")?.textContent).toBe(
      "A useful & accurate guide to captions.",
    );
    expect(document.querySelectorAll("item")).toHaveLength(1);
    expect(document.documentElement.textContent).not.toContain("Hidden draft");
  });

  it("allows public crawling while protecting private surfaces and references the root sitemap", async () => {
    const response = robotsResponse();
    const body = await response.text();

    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(body).toContain("User-agent: *\nAllow: /");
    expect(body).toContain("Disallow: /app/");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Sitemap: https://vidrial.vercel.app/sitemap.xml");
  });
});
