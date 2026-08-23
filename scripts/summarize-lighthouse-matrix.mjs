import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MATRIX = path.join(ROOT, "artifacts", "seo", "2026-08-24", "lighthouse-matrix");

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const rows = [];
for (const filename of (await readdir(MATRIX)).filter((name) => name.endsWith(".json")).sort()) {
  const report = JSON.parse(await readFile(path.join(MATRIX, filename), "utf8"));
  if (report.runtimeError) throw new Error(`${filename}: ${JSON.stringify(report.runtimeError)}`);
  const match = filename.match(/^(.*)-(desktop|mobile)\.json$/);
  if (!match) throw new Error(`Unexpected Lighthouse filename: ${filename}`);
  rows.push({
    page: match[1],
    profile: match[2],
    url: report.finalDisplayedUrl ?? report.finalUrl ?? report.requestedUrl,
    performance: Math.round(report.categories.performance.score * 100),
    accessibility: Math.round(report.categories.accessibility.score * 100),
    bestPractices: Math.round(report.categories["best-practices"].score * 100),
    seo: Math.round(report.categories.seo.score * 100),
    fcpMs: Math.round(report.audits["first-contentful-paint"].numericValue),
    lcpMs: Math.round(report.audits["largest-contentful-paint"].numericValue),
    tbtMs: Math.round(report.audits["total-blocking-time"].numericValue),
    cls: Number(report.audits["cumulative-layout-shift"].numericValue.toFixed(3)),
    measuredAt: report.fetchTime,
    note:
      match[1] === "signup"
        ? "SEO score reflects intentional noindex,nofollow account route"
        : "Public indexable page",
  });
}

if (rows.length !== 12) throw new Error(`Expected 12 Lighthouse reports, received ${rows.length}`);
await writeFile(
  path.join(MATRIX, "summary.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2)}\n`,
);
const headers = [
  "Page",
  "Profile",
  "URL",
  "Performance",
  "Accessibility",
  "Best Practices",
  "SEO",
  "FCP ms",
  "LCP ms",
  "TBT ms",
  "CLS",
  "Measured at",
  "Note",
];
const csvRows = rows.map((row) => [
  row.page,
  row.profile,
  row.url,
  row.performance,
  row.accessibility,
  row.bestPractices,
  row.seo,
  row.fcpMs,
  row.lcpMs,
  row.tbtMs,
  row.cls,
  row.measuredAt,
  row.note,
]);
await writeFile(
  path.join(MATRIX, "summary.csv"),
  `${[headers, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`,
);
console.table(rows.map(({ page, profile, performance, accessibility, bestPractices, seo }) => ({
  page,
  profile,
  performance,
  accessibility,
  bestPractices,
  seo,
})));
