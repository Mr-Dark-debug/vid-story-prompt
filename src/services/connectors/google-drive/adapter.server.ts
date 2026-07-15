import { z } from "zod";
import type { PaginatedAssets, RemoteMediaAsset } from "@/domain/connectors/types";

const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.string().regex(/^\d+$/).optional(),
  modifiedTime: z.string().optional(),
  thumbnailLink: z.string().url().optional(),
  videoMediaMetadata: z
    .object({
      durationMillis: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .optional(),
  audioMediaMetadata: z.object({ durationMillis: z.string().optional() }).optional(),
});

const responseSchema = z.object({
  nextPageToken: z.string().optional(),
  files: z.array(fileSchema).default([]),
});

function escapeQuery(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

export async function listGoogleDriveAssets(input: {
  accessToken: string;
  cursor?: string;
  query?: string;
  sharedWithMe?: boolean;
}): Promise<PaginatedAssets> {
  const mediaQuery =
    "trashed = false and (mimeType contains 'video/' or mimeType contains 'audio/')";
  const filters = [mediaQuery];
  if (input.query) filters.push(`name contains '${escapeQuery(input.query)}'`);
  if (input.sharedWithMe) filters.push("sharedWithMe = true");
  const params = new URLSearchParams({
    q: filters.join(" and "),
    fields:
      "nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,videoMediaMetadata(durationMillis,width,height),audioMediaMetadata(durationMillis))",
    pageSize: "50",
    orderBy: "modifiedTime desc",
    spaces: "drive",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  if (input.cursor) params.set("pageToken", input.cursor);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { authorization: `Bearer ${input.accessToken}`, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Google Drive browsing returned ${response.status}.`);
  const data = responseSchema.parse(await response.json());
  return { assets: data.files.map(toAsset), nextCursor: data.nextPageToken ?? null };
}

function toAsset(file: z.infer<typeof fileSchema>): RemoteMediaAsset {
  const duration =
    file.videoMediaMetadata?.durationMillis ?? file.audioMediaMetadata?.durationMillis;
  return {
    id: file.id,
    name: file.name,
    kind: file.mimeType.startsWith("video/") ? "video" : "audio",
    mimeType: file.mimeType,
    sizeBytes: file.size ? Number(file.size) : null,
    durationSeconds: duration ? Math.ceil(Number(duration) / 1000) : null,
    modifiedAt: file.modifiedTime ?? null,
    thumbnailUrl: file.thumbnailLink ?? null,
    metadata: {
      width: file.videoMediaMetadata?.width ?? null,
      height: file.videoMediaMetadata?.height ?? null,
    },
  };
}
