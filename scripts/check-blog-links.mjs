import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const directory = path.join(process.cwd(), "content", "blog");
const files = (await readdir(directory)).filter((file) => file.endsWith(".md")).sort();
const references = [];

for (const file of files) {
  const parsed = matter(await readFile(path.join(directory, file), "utf8"));
  for (const source of parsed.data.sources ?? []) references.push({ file, url: source.url, kind: "source" });
  for (const match of parsed.content.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) references.push({ file, url: match[1], kind: "body" });
}

const referencesByUrl = new Map();
for (const reference of references) {
  const usages = referencesByUrl.get(reference.url) ?? [];
  usages.push(reference);
  referencesByUrl.set(reference.url, usages);
}
const unique = [...referencesByUrl].map(([url, usages]) => ({ url, usages }));
const failures = [];
let cursor = 0;

await Promise.all(
  Array.from({ length: Math.min(6, unique.length) }, async () => {
    while (cursor < unique.length) {
      const item = unique[cursor++];
      try {
        let response = await fetch(item.url, {
          method: "HEAD",
          redirect: "follow",
          headers: { "user-agent": "VidrialEditorialLinkCheck/1.0" },
          signal: AbortSignal.timeout(12_000),
        });

        // Some documentation platforms reject HEAD even though the page loads normally.
        if (!response.ok && ![401, 403, 429].includes(response.status)) {
          response = await fetch(item.url, {
            method: "GET",
            redirect: "follow",
            headers: {
              accept: "text/html,application/xhtml+xml",
              "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36 VidrialEditorialLinkCheck/1.0",
            },
            signal: AbortSignal.timeout(15_000),
          });
        }

        const finalStatus = response.status;
        const finalOk = response.ok;
        await response.body?.cancel();
        if (!finalOk && ![401, 403, 429].includes(finalStatus)) {
          failures.push({ url: item.url, usages: item.usages, status: finalStatus });
        }
      } catch (error) {
        failures.push({
          url: item.url,
          usages: item.usages,
          status: "network-error",
          detail: error instanceof Error ? error.message : "unknown",
        });
      }
    }
  }),
);

console.log(JSON.stringify({ checked: unique.length, failures }, null, 2));
if (failures.length > 0) process.exitCode = 1;
