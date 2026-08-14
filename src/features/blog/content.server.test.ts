import { describe, expect, it } from "vitest";
import { createBlogRepository } from "./repository.server";

const BODY = `A clip needs enough context to make sense without the source episode.

## Keep the complete idea

Review the transcript before selecting boundaries, then verify the final caption timing and framing.`;

function article({
  slug,
  keyword,
  category,
  date,
  draft = false,
  reviewStatus = "PASS",
  related = [],
}: {
  slug: string;
  keyword: string;
  category: string;
  date: string;
  draft?: boolean;
  reviewStatus?: "PASS" | "REVISE" | "REJECT";
  related?: string[];
}): string {
  const relatedYaml = related.length
    ? `\n${related.map((value) => `  - "${value}"`).join("\n")}`
    : " []";
  return `---
title: "A practical guide for ${slug}"
slug: "${slug}"
description: "A concrete and carefully reviewed ${slug} guide for creators making short clips."
category: "${category}"
primaryKeyword: "${keyword}"
secondaryKeywords:
  - "supporting ${keyword}"
searchIntent: "informational"
author: "Vidrial Editorial Team"
publishedAt: "${date}"
updatedAt: "${date}"
reviewedAt: "${date}"
readingTime: 1
aiSummary:
  - "Choose moments that communicate a complete idea on their own."
  - "Check the surrounding transcript before deciding clip boundaries."
  - "Review caption timing and framing before publishing the export."
sources:
  - title: "YouTube Help"
    url: "https://support.google.com/youtube/answer/15424877"
related:${relatedYaml}
draft: ${draft}
reviewStatus: "${reviewStatus}"
---

${BODY}`;
}

describe("createBlogRepository", () => {
  it("returns only reviewed public articles in newest-first order", () => {
    const repository = createBlogRepository({
      "/content/blog/older.md": article({
        slug: "older-guide",
        keyword: "older keyword",
        category: "Workflow",
        date: "2026-07-01",
        related: ["newer-guide", "middle-guide"],
      }),
      "/content/blog/newer.md": article({
        slug: "newer-guide",
        keyword: "newer keyword",
        category: "Captions",
        date: "2026-07-25",
        related: ["older-guide", "middle-guide"],
      }),
      "/content/blog/middle.md": article({
        slug: "middle-guide",
        keyword: "middle keyword",
        category: "Workflow",
        date: "2026-07-15",
        related: ["older-guide", "newer-guide"],
      }),
      "/content/blog/draft.md": article({
        slug: "draft-guide",
        keyword: "draft keyword",
        category: "Workflow",
        date: "2026-07-28",
        draft: true,
        reviewStatus: "REVISE",
      }),
    });

    expect(repository.getPublishedArticles().map(({ slug }) => slug)).toEqual([
      "newer-guide",
      "middle-guide",
      "older-guide",
    ]);
    expect(repository.getAllArticlesForReview()).toHaveLength(4);
    expect(repository.getPublishedArticle("draft-guide")).toBeUndefined();
    expect(repository.getPublishedArticle("newer-guide")?.canonicalPath).toBe("/blog/newer-guide");
    expect(repository.getBlogCategories()).toEqual(["Captions", "Workflow"]);
  });

  it("validates the complete corpus before exposing any article", () => {
    expect(() =>
      createBlogRepository({
        "/content/blog/first.md": article({
          slug: "first-guide",
          keyword: "shared keyword",
          category: "Workflow",
          date: "2026-07-01",
        }),
        "/content/blog/second.md": article({
          slug: "second-guide",
          keyword: "shared keyword",
          category: "Workflow",
          date: "2026-07-02",
        }),
      }),
    ).toThrow(/second\.md: primaryKeyword: Duplicate primaryKeyword/);
  });

  it("rejects missing related articles before returning results", () => {
    expect(() =>
      createBlogRepository({
        "/content/blog/first.md": article({
          slug: "first-guide",
          keyword: "first keyword",
          category: "Workflow",
          date: "2026-07-01",
          related: ["missing-guide"],
        }),
      }),
    ).toThrow(/related\.0: Related article does not exist/);
  });
});
