import { z } from "zod";
import type { PaginatedAssets, RemoteMediaAsset } from "@/domain/connectors/types";

const fileSchema = z.object({
  ".tag": z.literal("file"),
  id: z.string(),
  name: z.string(),
  path_lower: z.string().optional(),
  size: z.number().int().nonnegative(),
  server_modified: z.string(),
});
const listSchema = z.object({
  entries: z.array(z.record(z.string(), z.unknown())),
  cursor: z.string().optional(),
  has_more: z.boolean().optional(),
});

const mediaExtension = /\.(mp4|mov|mkv|webm|m4v|mp3|wav|m4a)$/i;

export async function listDropboxAssets(input: {
  accessToken: string;
  cursor?: string;
  query?: string;
}): Promise<PaginatedAssets> {
  const searching = Boolean(input.query);
  const endpoint = input.cursor
    ? "https://api.dropboxapi.com/2/files/list_folder/continue"
    : searching
      ? "https://api.dropboxapi.com/2/files/search_v2"
      : "https://api.dropboxapi.com/2/files/list_folder";
  const body = input.cursor
    ? { cursor: input.cursor }
    : searching
      ? {
          query: input.query,
          options: { path: "", max_results: 50, file_status: "active", filename_only: true },
        }
      : {
          path: "",
          recursive: true,
          include_deleted: false,
          include_mounted_folders: true,
          limit: 100,
        };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${input.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Dropbox browsing returned ${response.status}.`);
  const raw = await response.json();
  const normalized =
    searching && !input.cursor
      ? {
          entries: z
            .object({
              matches: z.array(
                z.object({ metadata: z.object({ metadata: z.record(z.string(), z.unknown()) }) }),
              ),
              has_more: z.boolean().optional(),
            })
            .parse(raw)
            .matches.map((match) => match.metadata.metadata),
          has_more: false,
        }
      : raw;
  const data = listSchema.parse(normalized);
  const assets = data.entries.flatMap((entry) => {
    const parsed = fileSchema.safeParse(entry);
    return parsed.success && mediaExtension.test(parsed.data.name) ? [toAsset(parsed.data)] : [];
  });
  return { assets, nextCursor: data.has_more ? (data.cursor ?? null) : null };
}

function toAsset(file: z.infer<typeof fileSchema>): RemoteMediaAsset {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return {
    id: file.id,
    name: file.name,
    kind: ["mp3", "wav", "m4a"].includes(extension ?? "") ? "audio" : "video",
    mimeType: null,
    sizeBytes: file.size,
    durationSeconds: null,
    modifiedAt: file.server_modified,
    thumbnailUrl: null,
    metadata: { path: file.path_lower ?? null },
  };
}
