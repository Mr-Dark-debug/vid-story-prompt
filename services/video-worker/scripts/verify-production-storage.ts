// Explicit production smoke check: writes only random disposable objects, verifies
// byte equality, then removes precisely the objects created by this invocation.
import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uploadAsset, downloadAsset, supabase } from "../src/storage/client.js";
import { planChunkedAsset } from "../src/storage/chunked-assets.js";
import { env } from "../src/config/env.js";

if (!process.argv.includes("--write-storage"))
  throw new Error("Pass --write-storage to run the production round-trip check.");
const { data: owner, error } = await supabase
  .from("clip_jobs")
  .select("workspace_id,user_id")
  .eq("id", "d6b4d719-4bb6-409f-8355-6b93763fe2ff")
  .single();
if (error || !owner) throw new Error("The verification workspace could not be resolved.");
const directory = await mkdtemp(join(tmpdir(), "vidrial-storage-smoke-"));
const prefix = `${owner.workspace_id}/${owner.user_id}/${randomUUID()}/verification`;
try {
  for (const [bucket, size] of [
    ["clip-previews", 7 * 1024 * 1024],
    ["source-proxies", env.STORAGE_UPLOAD_CHUNK_BYTES + 1024],
  ] as const) {
    const path = `${prefix}/${randomUUID()}.bin`;
    const file = join(directory, "input.bin");
    const output = join(directory, `${bucket}.bin`);
    const bytes = Buffer.alloc(size, 91);
    await writeFile(file, bytes);
    const paths =
      size > env.STORAGE_UPLOAD_CHUNK_BYTES
        ? [
            ...planChunkedAsset(path, size, env.STORAGE_UPLOAD_CHUNK_BYTES).parts.map(
              (part) => part.path,
            ),
            path,
          ]
        : [path];
    try {
      await uploadAsset(bucket, path, file, "application/octet-stream");
      await downloadAsset(bucket, path, output);
      const digest = (data: Buffer) => createHash("sha256").update(data).digest("hex");
      if (digest(await readFile(output)) !== digest(bytes))
        throw new Error("Storage round-trip checksum mismatch.");
      console.log(JSON.stringify({ bucket, bytes: size, roundtrip: "passed" }));
    } finally {
      const { error: removalError } = await supabase.storage.from(bucket).remove(paths);
      if (removalError) {
        console.error(JSON.stringify({ cleanup: "failed", bucket, prefix }));
        process.exitCode = 1;
      }
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
