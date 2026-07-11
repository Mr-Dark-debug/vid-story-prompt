import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

export async function downloadAsset(bucket: string, path: string, destination: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  if (error) throw error;
  const response = await fetch(data.signedUrl, { signal: AbortSignal.timeout(30 * 60_000) });
  if (!response.ok || !response.body) throw new Error(`Storage download returned ${response.status}`);
  const { createWriteStream } = await import("node:fs");
  const { Readable } = await import("node:stream");
  const { pipeline } = await import("node:stream/promises");
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(destination, { flags: "wx" }));
}

export async function uploadAsset(bucket: string, path: string, file: string, contentType: string) {
  const { createReadStream } = await import("node:fs");
  const { stat } = await import("node:fs/promises");
  const { Readable } = await import("node:stream");
  const size = (await stat(file)).size;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encoded}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, "content-type": contentType, "content-length": String(size), "x-upsert": "false" },
    body: Readable.toWeb(createReadStream(file)) as never,
    // Required by Node fetch for streamed request bodies.
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  if (!response.ok) throw new Error(`Storage upload returned ${response.status}: ${await response.text()}`);
  return path;
}
