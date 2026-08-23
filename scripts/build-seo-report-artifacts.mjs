import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "artifacts", "seo", "2026-08-24");
const ORIGIN = "https://vidrial.vercel.app";

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

const inventory = JSON.parse(
  await readFile(path.join(OUTPUT, "url-inventory.json"), "utf8"),
);
const articleRows = inventory.rows.filter(
  (row) => row.routeType === "blog-article" && row.indexable && row.httpStatus === 200,
);
const publicArticleSlugs = new Set(articleRows.map((row) => new URL(row.url).pathname.split("/").at(-1)));
const contentFiles = (await readdir(path.join(ROOT, "content", "blog"))).filter((name) =>
  name.endsWith(".md"),
);
const articles = new Map();
for (const filename of contentFiles) {
  const parsed = matter(await readFile(path.join(ROOT, "content", "blog", filename), "utf8"));
  if (publicArticleSlugs.has(parsed.data.slug)) articles.set(parsed.data.slug, parsed.data);
}

const articleTable = articleRows
  .map((row) => {
    const slug = new URL(row.url).pathname.split("/").at(-1);
    const article = articles.get(slug);
    if (!article) throw new Error(`Missing public article frontmatter for ${slug}`);
    return [
      row.url,
      article.primaryKeyword,
      article.searchIntent,
      row.title,
      row.metaDescription,
      row.canonicalUrl,
      row.jsonLdTypes.join(" | "),
      row.outgoingInternalLinkCount,
      row.wordCount,
      article.updatedAt,
      "Published; editorial PASS; HTTP 200; indexable",
    ];
  })
  .sort((a, b) => a[0].localeCompare(b[0]));
await writeFile(
  path.join(OUTPUT, "blog-seo-inventory.csv"),
  toCsv(
    [
      "URL",
      "Primary keyword",
      "Target intent",
      "Title",
      "Meta description",
      "Canonical",
      "Structured data",
      "Outgoing internal links",
      "Rendered word count",
      "Content updated",
      "Status",
    ],
    articleTable,
  ),
);

const coreKeywords = [
  ["ai video editor for existing footage", "/", "commercial investigation"],
  ["ai video clipper", "/youtube-clipper", "commercial investigation"],
  ["youtube clip maker", "/youtube-clipper", "transactional"],
  ["ai video editing features", "/features", "commercial investigation"],
  ["ai video editing workflow", "/how-it-works", "informational"],
  ["ai video editor pricing", "/pricing", "commercial investigation"],
  ["explainable ai video editing", "/ai-transparency", "informational"],
  ["private ai video editor", "/security", "commercial investigation"],
];
const articleKeywords = articleTable.map((row) => [row[1], new URL(row[0]).pathname, row[2]]);
await writeFile(
  path.join(OUTPUT, "keyword-baseline.csv"),
  toCsv(
    [
      "Query",
      "Target URL",
      "Intent",
      "Current position",
      "Clicks",
      "Impressions",
      "CTR",
      "Source/date",
      "Notes",
    ],
    [...coreKeywords, ...articleKeywords].map(([query, target, intent]) => [
      query,
      `${ORIGIN}${target}`,
      intent,
      "Not measured",
      "Unavailable",
      "Unavailable",
      "Unavailable",
      "GSC property processing; 2026-08-24",
      "Baseline only; no ranking or traffic inferred",
    ]),
  ),
);

const priorityPaths = [
  "/",
  "/youtube-clipper",
  "/features",
  "/how-it-works",
  "/pricing",
  "/blog",
  "/ai-transparency",
  "/security",
  ...articleTable.slice(0, 12).map((row) => new URL(row[0]).pathname),
];
await writeFile(
  path.join(OUTPUT, "priority-url-monitoring.csv"),
  toCsv(
    [
      "Priority",
      "URL",
      "HTTP",
      "Indexable",
      "Sitemap",
      "Canonical",
      "GSC inspection",
      "Bing status",
      "Monitoring note",
    ],
    priorityPaths.map((pathname, index) => {
      const row = inventory.rows.find((candidate) => new URL(candidate.url).pathname === pathname);
      if (!row) throw new Error(`Priority URL missing from inventory: ${pathname}`);
      return [
        index + 1,
        row.url,
        row.httpStatus,
        row.indexable,
        row.sitemapIncluded,
        row.canonicalUrl,
        "Pending authenticated inspection",
        "Pending property import",
        "Review after provider data begins processing",
      ];
    }),
  ),
);

const contentSummary = {
  generatedAt: new Date().toISOString(),
  sourceInventoryGeneratedAt: inventory.summary.generatedAt,
  publicArticleCount: articleTable.length,
  priorityUrlCount: priorityPaths.length,
  keywordTargetCount: coreKeywords.length + articleKeywords.length,
  excludedDraftExample: `${ORIGIN}/blog/opusclip-alternatives`,
  exclusionReason: "Frontmatter draft=true and independent review status REVISE; production returns 404.",
};
await writeFile(
  path.join(OUTPUT, "report-artifacts-summary.json"),
  `${JSON.stringify(contentSummary, null, 2)}\n`,
);

console.log(JSON.stringify(contentSummary, null, 2));
