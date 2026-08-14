import matter from "gray-matter";
import { z } from "zod";

const WORDS_PER_MINUTE = 200;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const normalizedDate = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z.string().refine(isIsoDate, "Expected a real calendar date in YYYY-MM-DD format"),
);

const webUrl = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  }, "Expected an HTTP or HTTPS URL");

const uniqueStrings = (label: string) =>
  z.array(z.string().trim().min(1)).superRefine((values, context) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      const normalized = value.toLocaleLowerCase("en-US");
      if (seen.has(normalized)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate ${label}: ${value}`,
          path: [index],
        });
      }
      seen.add(normalized);
    });
  });

const blogSourceSchema = z.strictObject({
  title: z.string().trim().min(1),
  url: webUrl,
  checkedAt: normalizedDate.optional(),
});

const blogFaqSchema = z.strictObject({
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
});

const blogFrontmatterSchema = z
  .strictObject({
    title: z.string().trim().min(8).max(120),
    slug: z.string().trim().regex(SLUG_PATTERN, "Expected a lowercase kebab-case slug"),
    description: z.string().trim().min(20).max(320),
    category: z.string().trim().min(2).max(80),
    primaryKeyword: z.string().trim().min(2).max(120),
    secondaryKeywords: uniqueStrings("secondary keyword").max(12),
    searchIntent: z.string().trim().min(2).max(80),
    author: z.literal("Vidrial Editorial Team"),
    publishedAt: normalizedDate,
    updatedAt: normalizedDate,
    reviewedAt: normalizedDate,
    readingTime: z.number().int().positive().max(120),
    aiSummary: z.array(z.string().trim().min(10).max(280)).min(3).max(5),
    sources: z.array(blogSourceSchema).max(50),
    related: uniqueStrings("related slug")
      .max(5)
      .refine((values) => values.every((value) => SLUG_PATTERN.test(value)), {
        message: "Related entries must be lowercase kebab-case slugs",
      }),
    faqs: z.array(blogFaqSchema).max(20).optional().default([]),
    draft: z.boolean(),
    reviewStatus: z.enum(["PASS", "REVISE", "REJECT"]),
    featured: z.boolean().optional().default(false),
  })
  .superRefine((value, context) => {
    if (value.updatedAt < value.publishedAt) {
      context.addIssue({
        code: "custom",
        message: "updatedAt cannot be earlier than publishedAt",
        path: ["updatedAt"],
      });
    }

    if (value.reviewedAt < value.publishedAt) {
      context.addIssue({
        code: "custom",
        message: "reviewedAt cannot be earlier than publishedAt",
        path: ["reviewedAt"],
      });
    }

    if (!value.draft && value.reviewStatus !== "PASS") {
      context.addIssue({
        code: "custom",
        message: 'A public article requires reviewStatus: "PASS"',
        path: ["reviewStatus"],
      });
    }

    if (!value.draft && value.sources.length === 0) {
      context.addIssue({
        code: "custom",
        message: "A public article requires at least one source",
        path: ["sources"],
      });
    }

    if (value.related.includes(value.slug)) {
      context.addIssue({
        code: "custom",
        message: "An article cannot relate to itself",
        path: ["related"],
      });
    }
  });

export type ReviewStatus = "PASS" | "REVISE" | "REJECT";

export interface BlogSource {
  title: string;
  url: string;
  checkedAt?: string;
}

export interface BlogFaq {
  question: string;
  answer: string;
}

export interface BlogHeading {
  level: 2 | 3 | 4 | 5 | 6;
  text: string;
  id: string;
}

export interface BlogArticleMeta {
  title: string;
  slug: string;
  description: string;
  category: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  author: "Vidrial Editorial Team";
  publishedAt: string;
  updatedAt: string;
  reviewedAt: string;
  readingTime: number;
  aiSummary: string[];
  sources: BlogSource[];
  related: string[];
  faqs: BlogFaq[];
  draft: boolean;
  reviewStatus: ReviewStatus;
  featured: boolean;
  canonicalPath: string;
  wordCount: number;
  headings: BlogHeading[];
  excerpt: string;
}

export interface BlogArticle extends BlogArticleMeta {
  body: string;
  sourcePath: string;
}

export class BlogContentValidationError extends Error {
  readonly sourcePath: string;
  readonly fieldPath: string;

  constructor(sourcePath: string, fieldPath: string, message: string) {
    super(`${sourcePath}: ${fieldPath}: ${message}`);
    this.name = "BlogContentValidationError";
    this.sourcePath = sourcePath;
    this.fieldPath = fieldPath;
  }
}

export function parseBlogArticle(raw: string, sourcePath: string): BlogArticle {
  let parsedMatter: matter.GrayMatterFile<string>;
  try {
    parsedMatter = matter(raw);
  } catch (error) {
    throw new BlogContentValidationError(
      sourcePath,
      "frontmatter",
      error instanceof Error ? error.message : "Could not parse frontmatter",
    );
  }

  const frontmatter = blogFrontmatterSchema.safeParse(parsedMatter.data);
  if (!frontmatter.success) {
    const issue = frontmatter.error.issues[0];
    throw new BlogContentValidationError(
      sourcePath,
      formatFieldPath(issue?.path ?? []),
      issue?.message ?? "Invalid frontmatter",
    );
  }

  const body = parsedMatter.content.trim();
  if (!body) {
    throw new BlogContentValidationError(sourcePath, "body", "Article body cannot be empty");
  }
  if (/!\[[^\]]*\]\([^)]*\)|<img\b/i.test(withoutFencedCode(body))) {
    throw new BlogContentValidationError(
      sourcePath,
      "body.images",
      "Blog articles are text-only and cannot contain inline images",
    );
  }

  const headings = extractHeadings(body, sourcePath);
  const wordCount = countWords(body);
  const expectedReadingTime = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));

  if (frontmatter.data.readingTime !== expectedReadingTime) {
    throw new BlogContentValidationError(
      sourcePath,
      "readingTime",
      `Expected ${expectedReadingTime} minute(s) for ${wordCount} words at ${WORDS_PER_MINUTE} words per minute, received ${frontmatter.data.readingTime}`,
    );
  }

  return {
    ...frontmatter.data,
    body,
    sourcePath,
    canonicalPath: `/blog/${frontmatter.data.slug}`,
    wordCount,
    headings,
    excerpt: createExcerpt(body),
  };
}

export function validateBlogCorpus(rawArticles: Record<string, string>): BlogArticle[] {
  const articles = Object.entries(rawArticles)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sourcePath, raw]) => parseBlogArticle(raw, sourcePath));

  validateUniqueField(articles, "slug", (article) => article.slug);
  validateUniqueField(articles, "primaryKeyword", (article) => article.primaryKeyword);
  validateUniqueField(articles, "title", (article) => article.title);
  validateUniqueField(articles, "description", (article) => article.description);

  const bySlug = new Map(articles.map((article) => [article.slug, article]));
  for (const article of articles) {
    article.related.forEach((relatedSlug, index) => {
      const related = bySlug.get(relatedSlug);
      if (!related) {
        throw new BlogContentValidationError(
          article.sourcePath,
          `related.${index}`,
          `Related article does not exist: ${relatedSlug}`,
        );
      }
      if (!article.draft && (related.draft || related.reviewStatus !== "PASS")) {
        throw new BlogContentValidationError(
          article.sourcePath,
          `related.${index}`,
          `Public articles can only relate to public PASS articles: ${relatedSlug}`,
        );
      }
    });
    if (!article.draft && article.related.length < 2) {
      throw new BlogContentValidationError(
        article.sourcePath,
        "related",
        "A public article requires at least two related public articles",
      );
    }
  }

  return articles;
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function formatFieldPath(path: PropertyKey[]): string {
  return path.length === 0 ? "frontmatter" : path.map(String).join(".");
}

function validateUniqueField(
  articles: BlogArticle[],
  fieldPath: "slug" | "primaryKeyword" | "title" | "description",
  select: (article: BlogArticle) => string,
): void {
  const seen = new Map<string, string>();
  for (const article of articles) {
    const value = select(article);
    const normalized = value.trim().toLocaleLowerCase("en-US");
    const firstPath = seen.get(normalized);
    if (firstPath) {
      throw new BlogContentValidationError(
        article.sourcePath,
        fieldPath,
        `Duplicate ${fieldPath} "${value}"; first declared in ${firstPath}`,
      );
    }
    seen.set(normalized, article.sourcePath);
  }
}

function extractHeadings(body: string, sourcePath: string): BlogHeading[] {
  const headings: BlogHeading[] = [];
  const idCounts = new Map<string, number>();
  let fence: string | undefined;

  for (const line of body.split(/\r?\n/)) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1]?.[0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = undefined;
      continue;
    }
    if (fence) continue;

    const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;

    const level = match[1]!.length;
    const text = stripInlineMarkdown(match[2]!);
    if (level === 1) {
      throw new BlogContentValidationError(
        sourcePath,
        "body.headings",
        "Article Markdown must not contain H1 headings; the page layout supplies the H1",
      );
    }

    headings.push({
      level: level as BlogHeading["level"],
      text,
      id: uniqueHeadingId(text, idCounts),
    });
  }

  if (headings.length === 0) {
    throw new BlogContentValidationError(
      sourcePath,
      "body.headings",
      "Article body must contain at least one H2 heading",
    );
  }
  if (headings[0]!.level !== 2) {
    throw new BlogContentValidationError(
      sourcePath,
      "body.headings.0",
      "The first article heading must be H2",
    );
  }

  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1]!;
    const current = headings[index]!;
    if (current.level > previous.level + 1) {
      throw new BlogContentValidationError(
        sourcePath,
        `body.headings.${index}`,
        `Heading hierarchy skips from H${previous.level} to H${current.level}`,
      );
    }
  }

  return headings;
}

function uniqueHeadingId(text: string, counts: Map<string, number>): string {
  const base = slugify(text) || "section";
  const count = counts.get(base) ?? 0;
  counts.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function countWords(body: string): number {
  const plainText = markdownToPlainText(body);
  return plainText.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function createExcerpt(body: string): string {
  const paragraph = body
    .replace(/^\s*(```+|~~~+)[\s\S]*?^\s*\1.*$/gm, " ")
    .split(/\r?\n\s*\r?\n/)
    .map((part) => stripInlineMarkdown(part).replace(/\s+/g, " ").trim())
    .find((part) => part.length > 0 && !/^#{1,6}\s/.test(part));

  if (!paragraph) return "";
  if (paragraph.length <= 180) return paragraph;
  const shortened = paragraph
    .slice(0, 177)
    .replace(/\s+\S*$/, "")
    .trimEnd();
  return `${shortened}…`;
}

function markdownToPlainText(body: string): string {
  return stripInlineMarkdown(
    body
      .replace(/^\s*(```+|~~~+)[\s\S]*?^\s*\1.*$/gm, " ")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s*>\s?/gm, "")
      .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, ""),
  );
}

function withoutFencedCode(body: string): string {
  const lines: string[] = [];
  let fence: string | undefined;
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^\s*(```+|~~~+)/);
    if (match) {
      const marker = match[1]?.[0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = undefined;
      continue;
    }
    if (!fence) lines.push(line);
  }
  return lines.join("\n");
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_~]/g, "")
    .trim();
}
