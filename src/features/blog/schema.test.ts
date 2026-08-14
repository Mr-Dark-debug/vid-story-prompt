import { describe, expect, it } from "vitest";
import { BlogContentValidationError, parseBlogArticle, validateBlogCorpus } from "./schema";

function article(overrides: Record<string, unknown> = {}, body = VALID_BODY): string {
  const values = {
    title: "A practical clipping guide",
    slug: "practical-clipping-guide",
    description: "A concrete guide to choosing and producing useful short video clips.",
    category: "AI Video Clipping",
    primaryKeyword: "practical video clipping",
    secondaryKeywords: ["video workflow", "short clips"],
    searchIntent: "informational-commercial",
    author: "Vidrial Editorial Team",
    publishedAt: "2026-07-20",
    updatedAt: "2026-07-21",
    reviewedAt: "2026-07-21",
    readingTime: 1,
    aiSummary: [
      "Start with a clear publishing goal before selecting clips.",
      "Use transcript context to verify that each moment stands alone.",
      "Review caption timing and framing before every final export.",
    ],
    sources: [
      {
        title: "YouTube Help",
        url: "https://support.google.com/youtube/answer/15424877",
        checkedAt: "2026-07-20",
      },
    ],
    related: [],
    faqs: [
      { question: "Should every moment become a clip?", answer: "No. Keep only complete ideas." },
    ],
    draft: false,
    reviewStatus: "PASS",
    featured: true,
    ...overrides,
  };

  return `---\n${toYaml(values)}---\n\n${body}\n`;
}

const VALID_BODY = `A useful clip communicates one complete idea without relying on the original episode.

## Choose a complete moment

Read the lines before and after the candidate moment. Keep the context needed to understand the claim.

### Check the final cut

Review captions, framing, pacing, and the ending before publishing.`;

describe("parseBlogArticle", () => {
  it("parses strict frontmatter and derives normalized article fields", () => {
    const parsed = parseBlogArticle(article(), "content/blog/practical.md");

    expect(parsed.canonicalPath).toBe("/blog/practical-clipping-guide");
    expect(parsed.wordCount).toBeGreaterThan(30);
    expect(parsed.excerpt).toBe(
      "A useful clip communicates one complete idea without relying on the original episode.",
    );
    expect(parsed.headings).toEqual([
      {
        level: 2,
        text: "Choose a complete moment",
        id: "choose-a-complete-moment",
        sourceLine: 3,
      },
      { level: 3, text: "Check the final cut", id: "check-the-final-cut", sourceLine: 7 },
    ]);
  });

  it.each([
    ["publishedAt", "2026-02-30", "publishedAt"],
    ["sources", [{ title: "Unsafe source", url: "javascript:alert(1)" }], "sources.0.url"],
  ])("rejects malformed %s values and reports the field path", (field, value, path) => {
    expect(() => parseBlogArticle(article({ [field]: value }), "content/blog/invalid.md")).toThrow(
      expect.objectContaining({
        name: "BlogContentValidationError",
        sourcePath: "content/blog/invalid.md",
        fieldPath: path,
      }),
    );
  });

  it("rejects public draft leakage when editorial review has not passed", () => {
    expect(() =>
      parseBlogArticle(
        article({ draft: false, reviewStatus: "REVISE" }),
        "content/blog/unreviewed.md",
      ),
    ).toThrow(/reviewStatus: A public article requires reviewStatus/);
  });

  it.each([
    ["an H1", "# Duplicate page title\n\n## A valid section", /must not contain H1/],
    ["a skipped heading level", "## Start\n\n#### Skipped level", /skips from H2 to H4/],
    ["no H2", "Paragraphs without section headings.", /at least one H2/],
  ])("rejects invalid heading hierarchy: %s", (_label, body, expected) => {
    expect(() => parseBlogArticle(article({}, body), "content/blog/headings.md")).toThrow(expected);
  });

  it.each([
    ["Markdown", "![Decorative image](/hero.jpg)\n\n## Valid section"],
    ["HTML", '<img src="/hero.jpg" alt="Decorative image">\n\n## Valid section'],
  ])("rejects %s inline images in text-only articles", (_label, body) => {
    expect(() => parseBlogArticle(article({}, body), "content/blog/image.md")).toThrow(
      /text-only and cannot contain inline images/,
    );
  });

  it("rejects reading time that does not match the derived word count", () => {
    expect(() =>
      parseBlogArticle(article({ readingTime: 7 }), "content/blog/reading-time.md"),
    ).toThrow(/readingTime: Expected 1 minute/);
  });
});

describe("validateBlogCorpus", () => {
  it("accepts an empty corpus", () => {
    expect(validateBlogCorpus({})).toEqual([]);
  });

  it.each([
    ["slug", { slug: "practical-clipping-guide", primaryKeyword: "another keyword" }],
    ["primaryKeyword", { slug: "another-guide", primaryKeyword: "Practical Video Clipping" }],
  ])("rejects a duplicate %s across files", (field, overrides) => {
    expect(() =>
      validateBlogCorpus({
        "content/blog/first.md": article(),
        "content/blog/second.md": article(overrides),
      }),
    ).toThrow(new RegExp(`Duplicate ${field}`));
  });

  it("rejects related slugs that do not exist in the complete corpus", () => {
    expect(() =>
      validateBlogCorpus({
        "content/blog/first.md": article({ related: ["missing-guide"] }),
      }),
    ).toThrow(
      expect.objectContaining<Partial<BlogContentValidationError>>({
        fieldPath: "related.0",
        message: expect.stringContaining("missing-guide"),
      }),
    );
  });
});

function toYaml(value: Record<string, unknown>): string {
  return `${Object.entries(value)
    .map(([key, entry]) => `${key}: ${yamlValue(entry, 0)}`)
    .join("\n")}\n`;
}

function yamlValue(value: unknown, indent: number): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `\n${value
      .map((entry) => {
        if (typeof entry === "object" && entry !== null) {
          const fields = Object.entries(entry)
            .map(
              ([key, field], index) =>
                `${" ".repeat(indent + (index === 0 ? 2 : 4))}${index === 0 ? "- " : ""}${key}: ${yamlValue(field, indent + 4)}`,
            )
            .join("\n");
          return fields;
        }
        return `${" ".repeat(indent + 2)}- ${yamlValue(entry, indent + 2)}`;
      })
      .join("\n")}`;
  }
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}
