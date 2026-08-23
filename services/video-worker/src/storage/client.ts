import { createClient } from "@supabase/supabase-js";
import { createReadStream, createWriteStream } from "node:fs";
import { open, rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "../config/env.js";
import { TaskFailure } from "../domain/types.js";
import {
  CHUNK_MANIFEST_CONTENT_TYPE,
  parseChunkManifest,
  planChunkedAsset,
} from "./chunked-assets.js";

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function signedObjectResponse(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  if (error) throw error;
  const response = await fetch(data.signedUrl, { signal: AbortSignal.timeout(30 * 60_000) });
  if (!response.ok || !response.body) {
    throw new TaskFailure(
      "storage_download_failed",
      "Private media could not be read from storage.",
      true,
    );
  }
  return response;
}

export async function downloadAsset(bucket: string, path: string, destination: string) {
  const response = await signedObjectResponse(bucket, path);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType === CHUNK_MANIFEST_CONTENT_TYPE) {
    const text = await response.text();
    if (Buffer.byteLength(text) > 1024 * 1024) {
      throw new TaskFailure("storage_manifest_invalid", "The private source manifest is invalid.", false);
    }
    let manifest;
    try {
      manifest = parseChunkManifest(JSON.parse(text), path);
    } catch {
      throw new TaskFailure("storage_manifest_invalid", "The private source manifest is invalid.", false);
    }
    const output = await open(destination, "wx");
    let total = 0;
    try {
      for (const part of manifest.parts) {
        const partResponse = await signedObjectResponse(bucket, part.path);
        let received = 0;
        for await (const chunk of Readable.fromWeb(partResponse.body as never)) {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
          await output.write(bytes);
          received += bytes.length;
        }
        if (received !== part.bytes) {
          throw new TaskFailure(
            "storage_manifest_invalid",
            "A private source chunk has the wrong size.",
            false,
          );
        }
        total += received;
      }
      if (total !== manifest.totalBytes) {
        throw new TaskFailure(
          "storage_manifest_invalid",
          "The reconstructed private source has the wrong size.",
          false,
        );
      }
    } catch (error) {
      await output.close().catch(() => undefined);
      await rm(destination, { force: true }).catch(() => undefined);
      throw error;
    }
    await output.close();
    return;
  }
  await pipeline(
    Readable.fromWeb(response.body as never),
    createWriteStream(destination, { flags: "wx" }),
  );
}

async function uploadObject(
  bucket: string,
  path: string,
  body: BodyInit,
  size: number,
  contentType: string,
) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encoded}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        "content-type": contentType,
        "content-length": String(size),
        "x-upsert": "false",
      },
      body,
      ...(typeof body === "string" ? {} : { duplex: "half" as const }),
    } as RequestInit & { duplex?: "half" },
  );
  if (!response.ok) {
    throw new TaskFailure(
      "storage_upload_failed",
      "Private media could not be saved to storage.",
      true,
      { status: response.status },
    );
  }
}

export async function uploadAsset(bucket: string, path: string, file: string, contentType: string) {
  const size = (await stat(file)).size;
  if (bucket !== "source-media" || size <= env.STORAGE_UPLOAD_CHUNK_BYTES) {
    await uploadObject(
      bucket,
      path,
      Readable.toWeb(createReadStream(file)) as never,
      size,
      contentType,
    );
    return path;
  }

  const planned = planChunkedAsset(path, size, env.STORAGE_UPLOAD_CHUNK_BYTES);
  const uploaded: string[] = [];
  try {
    for (const part of planned.parts) {
      await uploadObject(
        bucket,
        part.path,
        Readable.toWeb(createReadStream(file, { start: part.start, end: part.end })) as never,
        part.bytes,
        "application/octet-stream",
      );
      uploaded.push(part.path);
    }
    const manifest = JSON.stringify(planned.manifest);
    await uploadObject(
      bucket,
      path,
      manifest,
      Buffer.byteLength(manifest),
      CHUNK_MANIFEST_CONTENT_TYPE,
    );
  } catch (error) {
    if (uploaded.length) {
      await supabase.storage.from(bucket).remove(uploaded).catch(() => undefined);
    }
    throw error;
  }
  return path;
}
