import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const contentDirectory = path.join(root, "content", "blog");
const files = (await readdir(contentDirectory)).filter((file) => file.endsWith(".md")).sort();
const watchlist = [
  "delve into",
  "dive into",
  "in a world where",
  "it's important to note",
  "when it comes to",
  "paving the way",
  "in conclusion",
  "in summary",
  "ever-evolving",
];

const articles = await Promise.all(
  files.map(async (file) => {
    const source = await readFile(path.join(contentDirectory, file), "utf8");
    const parsed = matter(source);
    return {
      file,
      data: parsed.data,
      body: parsed.content,
      normalizedBody: normalize(parsed.content),
      opening: firstParagraph(parsed.content),
      headings: [...parsed.content.matchAll(/^#{2,6}\s+(.+)$/gm)].map((match) => normalize(match[1])),
    };
  }),
);

const findings = [];
const primaryKeywords = new Map();
const openings = new Map();

for (const article of articles) {
  const keyword = normalize(String(article.data.primaryKeyword ?? ""));
  if (keyword) {
    if (primaryKeywords.has(keyword)) {
      findings.push({ severity: "BLOCK", files: [primaryKeywords.get(keyword), article.file], issue: `duplicate primary keyword: ${keyword}` });
    } else primaryKeywords.set(keyword, article.file);
  }

  const openingKey = article.opening.split(" ").slice(0, 14).join(" ");
  if (openingKey) {
    if (openings.has(openingKey)) {
      findings.push({ severity: "REVISE", files: [openings.get(openingKey), article.file], issue: "opening 14-word sequence is repeated" });
    } else openings.set(openingKey, article.file);
  }

  const body = article.normalizedBody;
  for (const phrase of watchlist) {
    const count = occurrences(body, phrase);
    if (count > 1) findings.push({ severity: "REVISE", files: [article.file], issue: `watchlist phrase repeated ${count} times: ${phrase}` });
  }

  const internalLinks = [...article.body.matchAll(/\]\((\/blog\/[^)]+)\)/g)].map((match) => match[1]);
  if (internalLinks.length < 2) findings.push({ severity: "REVISE", files: [article.file], issue: `only ${internalLinks.length} contextual blog links` });
  if (article.data.draft === false && article.data.reviewStatus !== "PASS") {
    findings.push({ severity: "BLOCK", files: [article.file], issue: "public article is not PASS" });
  }
}

for (let left = 0; left < articles.length; left += 1) {
  for (let right = left + 1; right < articles.length; right += 1) {
    const a = articles[left];
    const b = articles[right];
    const bodySimilarity = jaccard(shingles(a.normalizedBody, 5), shingles(b.normalizedBody, 5));
    const headingSimilarity = jaccard(new Set(a.headings), new Set(b.headings));
    if (bodySimilarity >= 0.42) findings.push({ severity: "BLOCK", files: [a.file, b.file], issue: `high five-word phrase overlap: ${bodySimilarity.toFixed(2)}` });
    else if (bodySimilarity >= 0.26) findings.push({ severity: "REVISE", files: [a.file, b.file], issue: `five-word phrase overlap: ${bodySimilarity.toFixed(2)}` });
    if (a.headings.length >= 3 && b.headings.length >= 3 && headingSimilarity >= 0.6) {
      findings.push({ severity: "REVISE", files: [a.file, b.file], issue: `heading template overlap: ${headingSimilarity.toFixed(2)}` });
    }
  }
}

const result = {
  articles: articles.length,
  blockers: findings.filter((finding) => finding.severity === "BLOCK").length,
  revisions: findings.filter((finding) => finding.severity === "REVISE").length,
  findings,
};
console.log(JSON.stringify(result, null, 2));
if (result.blockers > 0) process.exitCode = 1;

function normalize(value) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[`*_>#\[\](){}|]/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstParagraph(body) {
  return normalize(
    body
      .split(/\r?\n\s*\r?\n/)
      .find((part) => part.trim() && !/^\s*#{1,6}\s/.test(part)) ?? "",
  );
}

function occurrences(text, phrase) {
  let count = 0;
  let offset = 0;
  while ((offset = text.indexOf(phrase, offset)) >= 0) {
    count += 1;
    offset += phrase.length;
  }
  return count;
}

function shingles(text, size) {
  const words = text.split(" ").filter(Boolean);
  return new Set(words.slice(0, Math.max(0, words.length - size + 1)).map((_, index) => words.slice(index, index + size).join(" ")));
}

function jaccard(left, right) {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}
