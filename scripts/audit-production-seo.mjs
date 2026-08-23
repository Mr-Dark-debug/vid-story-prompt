import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ORIGIN = (process.env.SEO_AUDIT_ORIGIN || "https://vidrial.vercel.app").replace(/\/$/, "");
const TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const OUTPUT_DIR = path.resolve(
  process.argv.find((value) => value.startsWith("--output="))?.slice(9) || `artifacts/seo/${TODAY}`,
);
const MAX_URLS = 250;
const HTML_EXTENSIONS = new Set(["", ".html"]);

function unique(values) {
  return [...new Set(values)];
}

function xmlUrls(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => decodeXml(match[1].trim()));
}

function sitemapEntries(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map((match) => {
    const body = match[1];
    return {
      url: decodeXml(body.match(/<loc>([\s\S]*?)<\/loc>/i)?.[1]?.trim() || ""),
      lastmod: decodeXml(body.match(/<lastmod>([\s\S]*?)<\/lastmod>/i)?.[1]?.trim() || "") || null,
    };
  });
}

function rssUrls(xml) {
  return unique(
    [...xml.matchAll(/<(?:link|guid)(?:\s[^>]*)?>([\s\S]*?)<\/(?:link|guid)>/gi)].map((match) =>
      decodeXml(match[1].trim()),
    ),
  );
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function normalizeUrl(value) {
  try {
    const url = new URL(value, `${ORIGIN}/`);
    if (url.origin !== ORIGIN) return null;
    url.hash = "";
    url.search = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

function isHtmlCandidate(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;
  const pathname = new URL(normalized).pathname;
  if (pathname.startsWith("/api/")) return false;
  return HTML_EXTENSIONS.has(path.extname(pathname).toLowerCase());
}

function routeType(url) {
  const pathname = new URL(url).pathname;
  if (pathname === "/") return "homepage";
  if (pathname === "/blog") return "blog-index";
  if (pathname.startsWith("/blog/category/")) return "blog-category";
  if (pathname.startsWith("/blog/")) return "blog-article";
  if (pathname.startsWith("/use-cases")) return "use-case";
  if (pathname.startsWith("/docs")) return "documentation";
  if (
    [
      "/security",
      "/privacy",
      "/terms",
      "/cookies",
      "/acceptable-use",
      "/copyright",
      "/imprint",
      "/ai-transparency",
    ].includes(pathname)
  )
    return "trust-legal";
  if (
    ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"].includes(pathname)
  )
    return "authentication";
  if (pathname.startsWith("/app")) return "authenticated-app";
  return "marketing-public";
}

function robotsAllows(pathname, robotsText) {
  const lines = robotsText.split(/\r?\n/).map((line) => line.replace(/#.*/, "").trim());
  let applies = false;
  const disallows = [];
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") applies = value === "*";
    if (applies && key === "disallow" && value) disallows.push(value);
  }
  return !disallows.some((rule) => pathname.startsWith(rule));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "VidrialSEOAudit/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

async function redirectChain(url) {
  const chain = [];
  let current = url;
  for (let index = 0; index < 10; index += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": "VidrialSEOAudit/1.0" },
      signal: AbortSignal.timeout(30_000),
    });
    chain.push({ url: current, status: response.status });
    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get("location");
    if (!location) break;
    current = new URL(location, current).toString();
  }
  return chain;
}

async function localSeeds() {
  const sources = new Map();
  const add = (url, source) => {
    const normalized = normalizeUrl(url);
    if (!normalized || !isHtmlCandidate(normalized)) return;
    const current = sources.get(normalized) || new Set();
    current.add(source);
    sources.set(normalized, current);
  };

  const routeTree = await readFile("src/routeTree.gen.ts", "utf8");
  for (const match of routeTree.matchAll(/fullPath:\s*'([^']+)'/g)) {
    const route = match[1];
    if (!route.includes("$") && !route.includes("{") && !route.startsWith("/api/"))
      add(route, "route-tree");
  }

  const blogFiles = await import("node:fs/promises").then(({ readdir }) => readdir("content/blog"));
  for (const file of blogFiles.filter((value) => value.endsWith(".md"))) {
    const content = await readFile(path.join("content/blog", file), "utf8");
    const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] || "";
    const draft = frontmatter.match(/^draft:\s*(.+)$/m)?.[1]?.trim();
    const status = frontmatter.match(/^reviewStatus:\s*(.+)$/m)?.[1]?.trim();
    const slug = frontmatter.match(/^slug:\s*["']?([^"'\n]+)["']?$/m)?.[1]?.trim();
    if (draft === "false" && status === "PASS" && slug)
      add(`/blog/${slug}`, "published-content-registry");
  }
  return { sources, add };
}

function jsonLdTypes(values) {
  return unique(
    values.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      if (Array.isArray(value)) return jsonLdTypes(value);
      const graph = Array.isArray(value["@graph"]) ? jsonLdTypes(value["@graph"]) : [];
      const type = value["@type"];
      return [...(Array.isArray(type) ? type : typeof type === "string" ? [type] : []), ...graph];
    }),
  );
}

async function inspectPage(browserContext, url, robotsText, sitemap, sources) {
  const page = await browserContext.newPage();
  try {
    const chain = await redirectChain(url);
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(100);
    const observed = await page.evaluate(() => {
      const meta = (selector) =>
        document.querySelector(selector)?.getAttribute("content")?.trim() || null;
      const canonicals = [...document.querySelectorAll('link[rel="canonical"]')].map(
        (link) => link.href,
      );
      const links = [...document.querySelectorAll("a[href]")].map((anchor) => anchor.href);
      const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map(
        (script) => script.textContent || "",
      );
      const bodyText = document.body?.innerText || "";
      return {
        canonicals,
        title: document.title.trim(),
        description: meta('meta[name="description"]'),
        robots: meta('meta[name="robots"]'),
        h1: [...document.querySelectorAll("h1")]
          .map((node) => node.textContent?.trim() || "")
          .filter(Boolean),
        ogTitle: meta('meta[property="og:title"]'),
        ogDescription: meta('meta[property="og:description"]'),
        ogImage: meta('meta[property="og:image"]'),
        ogUrl: meta('meta[property="og:url"]'),
        twitterCard: meta('meta[name="twitter:card"]'),
        twitterTitle: meta('meta[name="twitter:title"]'),
        twitterDescription: meta('meta[name="twitter:description"]'),
        twitterImage: meta('meta[name="twitter:image"]'),
        modifiedDate: meta('meta[property="article:modified_time"]'),
        language: document.documentElement.lang || null,
        links,
        jsonLd,
        wordCount: bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0,
      };
    });

    const parsedJsonLd = [];
    const jsonLdErrors = [];
    for (const [index, raw] of observed.jsonLd.entries()) {
      try {
        parsedJsonLd.push(JSON.parse(raw));
      } catch (error) {
        jsonLdErrors.push(
          `script ${index + 1}: ${error instanceof Error ? error.message : "invalid JSON"}`,
        );
      }
    }
    const normalizedFinal = normalizeUrl(page.url()) || page.url();
    const internalLinks = unique(observed.links.map(normalizeUrl).filter(Boolean));
    const metaRobots = (observed.robots || "").toLowerCase();
    const xRobots = response?.headers()["x-robots-tag"] || null;
    const canonicalUrls = unique(
      observed.canonicals.map((canonical) => normalizeUrl(canonical) || canonical),
    );
    const canonical = canonicalUrls[0] || null;
    const allowed = robotsAllows(new URL(url).pathname, robotsText);
    const status = response?.status() || chain.at(-1)?.status || 0;
    const eligibleForIndexing =
      status === 200 &&
      allowed &&
      !metaRobots.includes("noindex") &&
      !(xRobots || "").toLowerCase().includes("noindex");
    const indexable = eligibleForIndexing && canonicalUrls.length === 1;

    return {
      url,
      routeType: routeType(url),
      sources: [...(sources.get(url) || [])].sort(),
      httpStatus: status,
      finalUrl: normalizedFinal,
      canonicalUrl: canonical,
      canonicalUrls,
      canonicalCount: canonicalUrls.length,
      canonicalIsSelf: canonicalUrls.length === 1 && canonical === url,
      eligibleForIndexing,
      indexable,
      robotsAllowed: allowed,
      robotsMeta: observed.robots,
      xRobotsTag: xRobots,
      sitemapIncluded: sitemap.has(url),
      title: observed.title || null,
      titleLength: observed.title.length,
      metaDescription: observed.description,
      descriptionLength: observed.description?.length || 0,
      h1: observed.h1,
      h1Count: observed.h1.length,
      openGraph: {
        title: observed.ogTitle,
        description: observed.ogDescription,
        image: observed.ogImage,
        url: observed.ogUrl,
      },
      twitter: {
        card: observed.twitterCard,
        title: observed.twitterTitle,
        description: observed.twitterDescription,
        image: observed.twitterImage,
      },
      jsonLdTypes: jsonLdTypes(parsedJsonLd),
      structuredDataValidity:
        observed.jsonLd.length === 0
          ? "none"
          : jsonLdErrors.length === 0
            ? "valid-json"
            : "invalid-json",
      structuredDataErrors: jsonLdErrors,
      incomingInternalLinkCount: 0,
      outgoingInternalLinkCount: internalLinks.length,
      outgoingInternalLinks: internalLinks,
      wordCount: observed.wordCount,
      modifiedDate: observed.modifiedDate,
      sitemapLastmod: sitemap.get(url) || null,
      duplicateTitle: false,
      duplicateDescription: false,
      orphanPage: false,
      redirectChain: chain,
      language: observed.language,
      error: null,
    };
  } catch (error) {
    return {
      url,
      routeType: routeType(url),
      sources: [...(sources.get(url) || [])].sort(),
      httpStatus: 0,
      finalUrl: null,
      canonicalUrl: null,
      canonicalUrls: [],
      canonicalCount: 0,
      canonicalIsSelf: false,
      eligibleForIndexing: false,
      indexable: false,
      robotsAllowed: robotsAllows(new URL(url).pathname, robotsText),
      robotsMeta: null,
      xRobotsTag: null,
      sitemapIncluded: sitemap.has(url),
      title: null,
      titleLength: 0,
      metaDescription: null,
      descriptionLength: 0,
      h1: [],
      h1Count: 0,
      openGraph: { title: null, description: null, image: null, url: null },
      twitter: { card: null, title: null, description: null, image: null },
      jsonLdTypes: [],
      structuredDataValidity: "none",
      structuredDataErrors: [],
      incomingInternalLinkCount: 0,
      outgoingInternalLinkCount: 0,
      outgoingInternalLinks: [],
      wordCount: 0,
      modifiedDate: null,
      sitemapLastmod: sitemap.get(url) || null,
      duplicateTitle: false,
      duplicateDescription: false,
      orphanPage: false,
      redirectChain: [],
      language: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

function markDuplicates(rows, field, outputField) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.indexable) continue;
    const value = row[field]?.trim().toLowerCase();
    if (!value) continue;
    groups.set(value, [...(groups.get(value) || []), row]);
  }
  for (const group of groups.values())
    if (group.length > 1) for (const row of group) row[outputField] = true;
}

function csvEscape(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const { sources, add } = await localSeeds();
  const robotsText = await fetchText(`${ORIGIN}/robots.txt`);
  const sitemapIndex = await fetchText(`${ORIGIN}/sitemap.xml`);
  const childSitemaps = xmlUrls(sitemapIndex);
  const sitemap = new Map();
  for (const child of childSitemaps) {
    const xml = await fetchText(child);
    for (const entry of sitemapEntries(xml)) {
      const normalized = normalizeUrl(entry.url);
      if (!normalized) continue;
      sitemap.set(normalized, entry.lastmod);
      add(normalized, "sitemap");
    }
  }
  const rss = await fetchText(`${ORIGIN}/rss.xml`);
  for (const url of rssUrls(rss)) add(url, "rss");
  add(`${ORIGIN}/`, "crawl-seed");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "VidrialSEOAudit/1.0 (+https://vidrial.vercel.app/)",
  });
  const rows = [];
  const visited = new Set();
  const queue = [...sources.keys()].sort();
  while (queue.length && visited.size < MAX_URLS) {
    const batch = queue.splice(0, 4).filter((url) => !visited.has(url));
    batch.forEach((url) => visited.add(url));
    const inspected = await Promise.all(
      batch.map((url) => inspectPage(context, url, robotsText, sitemap, sources)),
    );
    rows.push(...inspected);
    for (const row of inspected) {
      for (const linked of row.outgoingInternalLinks) {
        if (!visited.has(linked) && isHtmlCandidate(linked) && !queue.includes(linked)) {
          add(linked, "production-crawl");
          queue.push(linked);
        }
      }
    }
  }
  await browser.close();

  const rowByUrl = new Map(rows.map((row) => [row.url, row]));
  for (const row of rows)
    for (const linked of row.outgoingInternalLinks) {
      const target = rowByUrl.get(linked);
      if (target) target.incomingInternalLinkCount += 1;
    }
  for (const row of rows)
    row.orphanPage =
      row.url !== `${ORIGIN}/` && row.indexable && row.incomingInternalLinkCount === 0;
  markDuplicates(rows, "title", "duplicateTitle");
  markDuplicates(rows, "metaDescription", "duplicateDescription");
  rows.sort((left, right) => left.url.localeCompare(right.url, "en"));

  const summary = {
    generatedAt: new Date().toISOString(),
    origin: ORIGIN,
    inventoryCount: rows.length,
    sitemapUrlCount: sitemap.size,
    indexableCount: rows.filter((row) => row.indexable).length,
    errorCount: rows.filter((row) => row.error).length,
    non200Count: rows.filter((row) => row.httpStatus !== 200).length,
    missingCanonicalCount: rows.filter((row) => row.eligibleForIndexing && row.canonicalCount === 0)
      .length,
    multipleCanonicalCount: rows.filter((row) => row.canonicalCount > 1).length,
    nonSelfCanonicalCount: rows.filter(
      (row) => row.eligibleForIndexing && row.canonicalCount === 1 && !row.canonicalIsSelf,
    ).length,
    missingDescriptionCount: rows.filter((row) => row.indexable && !row.metaDescription).length,
    missingH1Count: rows.filter((row) => row.indexable && row.h1Count !== 1).length,
    duplicateTitleCount: rows.filter((row) => row.duplicateTitle).length,
    duplicateDescriptionCount: rows.filter((row) => row.duplicateDescription).length,
    orphanPageCount: rows.filter((row) => row.orphanPage).length,
    invalidStructuredDataCount: rows.filter((row) => row.structuredDataValidity === "invalid-json")
      .length,
  };

  await writeFile(
    path.join(OUTPUT_DIR, "url-inventory.json"),
    `${JSON.stringify({ summary, rows }, null, 2)}\n`,
  );
  const columns = [
    "url",
    "routeType",
    "httpStatus",
    "finalUrl",
    "canonicalUrl",
    "canonicalUrls",
    "canonicalCount",
    "canonicalIsSelf",
    "eligibleForIndexing",
    "indexable",
    "robotsAllowed",
    "robotsMeta",
    "sitemapIncluded",
    "title",
    "titleLength",
    "metaDescription",
    "descriptionLength",
    "h1",
    "openGraph",
    "twitter",
    "jsonLdTypes",
    "incomingInternalLinkCount",
    "outgoingInternalLinkCount",
    "wordCount",
    "modifiedDate",
    "sitemapLastmod",
    "duplicateTitle",
    "duplicateDescription",
    "orphanPage",
    "redirectChain",
    "structuredDataValidity",
    "structuredDataErrors",
    "sources",
    "error",
  ];
  const csv = [
    columns.map(csvEscape).join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
  await writeFile(path.join(OUTPUT_DIR, "url-inventory.csv"), `${csv}\n`);
  await writeFile(
    path.join(OUTPUT_DIR, "audit-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
