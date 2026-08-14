import { readdir, readFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBlogCorpus } from "../src/features/blog/schema.ts";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const contentDirectory = resolve(repositoryRoot, "content/blog");

try {
  const entries = await readdir(contentDirectory, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => resolve(contentDirectory, entry.name))
    .sort((left, right) => left.localeCompare(right));

  const rawArticles = Object.fromEntries(
    await Promise.all(
      markdownFiles.map(async (absolutePath) => [
        relative(repositoryRoot, absolutePath).split(sep).join("/"),
        await readFile(absolutePath, "utf8"),
      ]),
    ),
  );

  const articles = validateBlogCorpus(rawArticles);
  process.stdout.write(
    `Blog content validation passed: ${articles.length} article${articles.length === 1 ? "" : "s"}.\n`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Blog content validation failed: ${message}\n`);
  process.exitCode = 1;
}
