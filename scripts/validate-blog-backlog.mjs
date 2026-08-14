import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const blogDirectory = resolve(repositoryRoot, "content/blog");
const researchDirectory = resolve(repositoryRoot, "content/research");
const reviewDirectory = resolve(repositoryRoot, "content/reviews");
const backlogPath = resolve(blogDirectory, "backlog.json");
const launchIds = new Set([1, 2, ...Array.from({ length: 16 }, (_, index) => index + 5)]);

const listMarkdownBasenames = async (directory) =>
  new Set(
    (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name.slice(0, -3)),
  );

try {
  const backlog = JSON.parse(await readFile(backlogPath, "utf8"));
  if (!Array.isArray(backlog) || backlog.length !== 60) {
    throw new Error(`Expected exactly 60 backlog entries, found ${backlog.length}.`);
  }

  const expectedSlugs = new Set(backlog.map((entry) => entry.slug));
  if (expectedSlugs.size !== backlog.length) {
    throw new Error("The editorial backlog contains duplicate slugs.");
  }

  const [articleSlugs, researchSlugs, reviewSlugs] = await Promise.all([
    listMarkdownBasenames(blogDirectory),
    listMarkdownBasenames(researchDirectory),
    listMarkdownBasenames(reviewDirectory),
  ]);

  const missingArticles = [...expectedSlugs].filter((slug) => !articleSlugs.has(slug));
  const unexpectedArticles = [...articleSlugs].filter((slug) => !expectedSlugs.has(slug));
  const missingResearch = [...expectedSlugs].filter((slug) => !researchSlugs.has(slug));
  const unexpectedResearch = [...researchSlugs].filter((slug) => !expectedSlugs.has(slug));
  const missingReviews = [...expectedSlugs].filter((slug) => !reviewSlugs.has(slug));
  const unexpectedReviews = [...reviewSlugs].filter((slug) => !expectedSlugs.has(slug));

  const metadataMismatches = [];
  for (const entry of backlog) {
    if (!articleSlugs.has(entry.slug)) continue;
    const rawArticle = await readFile(resolve(blogDirectory, `${entry.slug}.md`), "utf8");
    const { data } = matter(rawArticle);
    if (data.slug !== entry.slug) {
      metadataMismatches.push(`${entry.slug}: frontmatter slug is ${String(data.slug)}`);
    }
    if (data.primaryKeyword !== entry.primaryKeyword) {
      metadataMismatches.push(
        `${entry.slug}: primaryKeyword is ${String(data.primaryKeyword)}; expected ${entry.primaryKeyword}`,
      );
    }
    const shouldBePublic = launchIds.has(entry.id);
    if (shouldBePublic && (data.draft !== false || data.reviewStatus !== "PASS")) {
      metadataMismatches.push(`${entry.slug}: launch article must be public and PASS`);
    }
    if (!shouldBePublic && data.draft !== true) {
      metadataMismatches.push(`${entry.slug}: post-launch article must remain a draft`);
    }
  }

  const failures = [
    missingArticles.length ? `Missing articles: ${missingArticles.join(", ")}` : "",
    unexpectedArticles.length ? `Unexpected articles: ${unexpectedArticles.join(", ")}` : "",
    missingResearch.length ? `Missing research notes: ${missingResearch.join(", ")}` : "",
    unexpectedResearch.length ? `Unexpected research notes: ${unexpectedResearch.join(", ")}` : "",
    missingReviews.length ? `Missing reviews: ${missingReviews.join(", ")}` : "",
    unexpectedReviews.length ? `Unexpected reviews: ${unexpectedReviews.join(", ")}` : "",
    ...metadataMismatches,
  ].filter(Boolean);

  if (failures.length) {
    throw new Error(failures.join("\n"));
  }

  process.stdout.write(
    "Blog backlog validation passed: 60 articles, 60 paired research notes, and 60 independent reviews.\n",
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Blog backlog validation failed: ${message}\n`);
  process.exitCode = 1;
}
