import { z } from "zod";
import type { PaginatedAssets, RemoteMediaAsset } from "@/domain/connectors/types";

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  lastModifiedDateTime: z.string().optional(),
  file: z.object({ mimeType: z.string() }),
  video: z
    .object({
      duration: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .optional(),
  audio: z.object({ duration: z.number().optional() }).optional(),
  thumbnails: z
    .array(z.object({ medium: z.object({ url: z.string().url() }).optional() }))
    .optional(),
});
const responseSchema = z.object({
  value: z.array(z.record(z.string(), z.unknown())),
  "@odata.nextLink": z.string().url().optional(),
});

export async function listOneDriveAssets(input: {
  accessToken: string;
  cursor?: string;
  query?: string;
}): Promise<PaginatedAssets> {
  const base = input.query
    ? `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(input.query.replaceAll("'", "''"))}')`
    : "https://graph.microsoft.com/v1.0/me/drive/root/children";
  const url =
    input.cursor ??
    `${base}?$top=50&$expand=thumbnails&$select=id,name,size,lastModifiedDateTime,file,video,audio,thumbnails`;
  if (!url.startsWith("https://graph.microsoft.com/"))
    throw new Error("Invalid OneDrive page cursor.");
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${input.accessToken}`, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`OneDrive browsing returned ${response.status}.`);
  const data = responseSchema.parse(await response.json());
  const assets = data.value.flatMap((item) => {
    const parsed = itemSchema.safeParse(item);
    if (!parsed.success || !/^(audio|video)\//.test(parsed.data.file.mimeType)) return [];
    return [toAsset(parsed.data)];
  });
  return { assets, nextCursor: data["@odata.nextLink"] ?? null };
}

function toAsset(item: z.infer<typeof itemSchema>): RemoteMediaAsset {
  const duration = item.video?.duration ?? item.audio?.duration;
  return {
    id: item.id,
    name: item.name,
    kind: item.file.mimeType.startsWith("video/") ? "video" : "audio",
    mimeType: item.file.mimeType,
    sizeBytes: item.size,
    durationSeconds: duration ? Math.ceil(duration / 1000) : null,
    modifiedAt: item.lastModifiedDateTime ?? null,
    thumbnailUrl: item.thumbnails?.[0]?.medium?.url ?? null,
    metadata: { width: item.video?.width ?? null, height: item.video?.height ?? null },
  };
}
