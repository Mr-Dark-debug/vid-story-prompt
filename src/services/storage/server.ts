import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";

const extensions: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
};

export const prepareSourceUpload = createServerFn({ method: "POST" })
  .validator(
    z.object({
      filename: z.string().min(1).max(255),
      mimeType: z.string().max(120),
      sizeBytes: z
        .number()
        .int()
        .positive()
        .max(10 * 1024 ** 3),
      sourceType: z.literal("local_upload"),
      projectId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("A workspace is required before uploading.");
    const extension = extensions[data.mimeType];
    if (!extension)
      throw new Error(
        "Choose an MP4, MOV, MKV, WebM or M4V video. The worker validates the actual streams after upload.",
      );
    const ingestionId = randomUUID();
    const assetId = randomUUID();
    const objectPath = `${session.workspaceId}/${session.id}/${ingestionId}/source/${assetId}.${extension}`;
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("media_assets")
      .insert({
        id: assetId,
        workspace_id: session.workspaceId,
        user_id: session.id,
        project_id: data.projectId,
        source_type: data.sourceType,
        storage_bucket: "source-media",
        storage_path: objectPath,
        original_filename: data.filename,
        display_name: data.filename,
        mime_type: data.mimeType,
        size_bytes: data.sizeBytes,
        status: "uploading",
        metadata_json: { browserMimeType: data.mimeType },
      });
    if (error) throw new Error(`Upload could not be prepared: ${error.message}`);
    return { assetId, bucket: "source-media", objectPath };
  });

export const completeSourceUpload = createServerFn({ method: "POST" })
  .validator(
    z.object({
      assetId: z.string().uuid(),
      durationSeconds: z.number().nonnegative().max(86_400).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session) throw new Error("Your session expired.");
    const { error } = await getSupabaseServerClient()
      .from("media_assets")
      .update({
        status: "uploaded",
        duration_seconds: data.durationSeconds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.assetId)
      .eq("user_id", session.id);
    if (error) throw new Error(`Upload could not be finalised: ${error.message}`);
    return { ok: true };
  });
