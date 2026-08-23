import { z } from "zod";

export const CHUNK_MANIFEST_CONTENT_TYPE = "application/vnd.vidrial.chunk-manifest+json";

const manifestSchema = z.object({
  version: z.literal(1),
  totalBytes: z.number().int().positive(),
  parts: z
    .array(z.object({ path: z.string().min(1).max(2048), bytes: z.number().int().positive() }))
    .min(2)
    .max(4096),
});

export type ChunkManifest = z.infer<typeof manifestSchema>;

export function planChunkedAsset(path: string, totalBytes: number, chunkBytes: number) {
  if (!Number.isSafeInteger(totalBytes) || totalBytes <= chunkBytes) {
    throw new Error("Chunk planning requires a file larger than one chunk.");
  }
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0) {
    throw new Error("Chunk size must be a positive safe integer.");
  }
  const parts = [];
  for (let start = 0, index = 0; start < totalBytes; start += chunkBytes, index += 1) {
    const bytes = Math.min(chunkBytes, totalBytes - start);
    parts.push({
      path: `${path}.parts/${String(index).padStart(5, "0")}`,
      start,
      end: start + bytes - 1,
      bytes,
    });
  }
  return {
    parts,
    manifest: {
      version: 1 as const,
      totalBytes,
      parts: parts.map(({ path: partPath, bytes }) => ({ path: partPath, bytes })),
    },
  };
}

export function parseChunkManifest(value: unknown, objectPath: string): ChunkManifest {
  const manifest = manifestSchema.parse(value);
  const prefix = `${objectPath}.parts/`;
  let total = 0;
  for (const [index, part] of manifest.parts.entries()) {
    if (part.path !== `${prefix}${String(index).padStart(5, "0")}`) {
      throw new Error("Chunk manifest contains an unexpected object path.");
    }
    total += part.bytes;
  }
  if (total !== manifest.totalBytes) {
    throw new Error("Chunk manifest size does not match its parts.");
  }
  return manifest;
}
