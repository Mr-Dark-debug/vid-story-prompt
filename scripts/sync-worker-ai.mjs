// Keeps services/video-worker/src/vendor/ai in lockstep with src/domain/ai.
//
// The worker is a separate package with its own Docker build context, so it cannot import the web
// app's source tree. The pure AI domain (registry, adapters, errors, credential crypto) is therefore
// copied verbatim. `npm run ai:sync` regenerates the copy; `npm run ai:check` (also run by the unit
// tests) fails when it has drifted.
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "src", "domain", "ai");
const target = join(root, "services", "video-worker", "src", "vendor", "ai");
const HEADER =
  "// GENERATED from src/domain/ai by scripts/sync-worker-ai.mjs. Do not edit; run `npm run ai:sync`.\n";
const EXCLUDED = [/\.test\.ts$/, /^test-helpers\.ts$/, /^adapter-matrix\.ts$/];

const normalize = (text) => text.replace(/\r\n/g, "\n");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.name.endsWith(".ts") && !EXCLUDED.some((pattern) => pattern.test(entry.name))) {
      files.push(full);
    }
  }
  return files.sort();
}

async function expected() {
  const output = new Map();
  for (const file of await walk(source)) {
    output.set(
      relative(source, file).replaceAll("\\", "/"),
      HEADER + normalize(await readFile(file, "utf8")),
    );
  }
  return output;
}

async function existing() {
  const output = new Map();
  try {
    for (const file of await walk(target)) {
      output.set(
        relative(target, file).replaceAll("\\", "/"),
        normalize(await readFile(file, "utf8")),
      );
    }
  } catch {
    // No copy yet.
  }
  return output;
}

const mode = process.argv[2] ?? "--write";
const wanted = await expected();

if (mode === "--check") {
  const current = await existing();
  const problems = [];
  for (const [name, content] of wanted) {
    if (!current.has(name)) problems.push(`missing ${name}`);
    else if (current.get(name) !== content) problems.push(`out of date ${name}`);
  }
  for (const name of current.keys()) if (!wanted.has(name)) problems.push(`stale ${name}`);
  if (problems.length) {
    console.error(
      `Worker AI copy has drifted (run "npm run ai:sync"):\n - ${problems.join("\n - ")}`,
    );
    process.exit(1);
  }
  console.log(`Worker AI copy is in sync (${wanted.size} files).`);
} else {
  await rm(target, { recursive: true, force: true });
  for (const [name, content] of wanted) {
    const destination = join(target, name);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  console.log(`Wrote ${wanted.size} files to ${relative(root, target)}.`);
}
