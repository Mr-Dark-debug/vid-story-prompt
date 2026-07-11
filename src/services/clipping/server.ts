import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";

const sourceType = z.enum([
  "local_upload",
  "direct_owned_media_url",
  "youtube_metadata",
  "youtube_connected_channel",
]);
const jobInput = z.object({
  sourceType,
  sourceUrl: z.string().url().max(2048).nullable(),
  sourceIdentifier: z.string().max(255).nullable(),
  sourceDurationSeconds: z.number().int().positive(),
  sourceAssetId: z.string().uuid().nullable(),
  sourceMetadata: z.object({
    title: z.string().max(500).optional(),
    channelId: z.string().max(255).optional(),
    channelTitle: z.string().max(500).optional(),
    thumbnailUrl: z.string().url().optional(),
  }),
  settings: z.record(z.unknown()),
  requestedClipCount: z.number().int().min(1).max(50),
  rightsAccepted: z.literal(true),
  idempotencyKey: z.string().uuid(),
});

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export const createClipJob = createServerFn({ method: "POST" })
  .validator(jobInput)
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("A workspace is required.");
    const client = getSupabaseServerClient() as unknown as RpcClient;
    const { data: jobId, error } = await client.rpc("create_clip_job", {
      p_workspace_id: session.workspaceId,
      p_source_type: data.sourceType,
      p_source_url: data.sourceUrl,
      p_source_identifier: data.sourceIdentifier,
      p_source_duration_seconds: data.sourceDurationSeconds,
      p_source_asset_id: data.sourceAssetId,
      p_source_metadata: data.sourceMetadata,
      p_settings: data.settings,
      p_requested_clip_count: data.requestedClipCount,
      p_attestation_version: "youtube-clipper-rights-v1",
      p_policy_version: "vidrial-content-policy-v1",
      p_request_metadata: { client: "web", locale: "en" },
      p_idempotency_key: data.idempotencyKey,
    });
    if (error || typeof jobId !== "string")
      throw new Error(error?.message ?? "The clipping job could not be created.");
    return { jobId };
  });

export const listClipJobs = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getCurrentSession();
  if (!session?.workspaceId) return [];
  const { data, error } = await getSupabaseServerClient()
    .from("clip_jobs")
    .select(
      "id,source_title,source_thumbnail_url,status,requested_clip_count,completed_clip_count,created_at,retention_expires_at,error_message",
    )
    .eq("workspace_id", session.workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
});

export const getClipJob = createServerFn({ method: "GET" })
  .validator(z.object({ jobId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const [{ data: job, error }, { data: events }, { data: clips }, { data: exports }] =
      await Promise.all([
      supabase.from("clip_jobs").select("*").eq("id", data.jobId).single(),
      supabase
        .from("processing_events")
        .select("*")
        .eq("clip_job_id", data.jobId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("clips")
        .select("*")
        .eq("clip_job_id", data.jobId)
        .is("deleted_at", null)
        .order("created_at"),
      supabase
        .from("exports")
        .select("id,clip_id,export_type,format,resolution,watermarked,status,expires_at,created_at")
        .eq("clip_job_id", data.jobId)
        .order("created_at", { ascending: false }),
    ]);
    if (error) throw new Error(error.message);
    return { job, events: events ?? [], clips: clips ?? [], exports: exports ?? [] };
  });

export const cancelClipJob = createServerFn({ method: "POST" })
  .validator(z.object({ jobId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { error } = await getSupabaseServerClient()
      .from("clip_jobs")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.jobId)
      .not("status", "in", '("completed","expired")');
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getClipForEditor = createServerFn({ method: "GET" })
  .validator(z.object({ clipId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const { data: clip, error } = await supabase
      .from("clips")
      .select("*")
      .eq("id", data.clipId)
      .single();
    if (error) throw new Error(error.message);
    const { data: versions } = await supabase
      .from("clip_versions")
      .select("*")
      .eq("clip_id", data.clipId)
      .order("version_number", { ascending: false });
    return { clip, versions: versions ?? [] };
  });

export const saveClipVersion = createServerFn({ method: "POST" })
  .validator(
    z.object({
      clipId: z.string().uuid(),
      manifest: z
        .object({
          startSeconds: z.number().nonnegative(),
          endSeconds: z.number().positive(),
          aspectRatio: z.enum(["9:16", "1:1", "16:9"]),
          cropMode: z.enum(["fit", "fill", "centre", "blur", "manual"]),
          focalPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
          captions: z.object({
            text: z.string().max(20000),
            preset: z.string().max(80),
            position: z.enum(["top", "middle", "bottom"]),
            activeWord: z.boolean(),
            profanityMask: z.boolean(),
          }),
          audio: z.object({
            gainDb: z.number().min(-30).max(12),
            muted: z.boolean(),
            fadeInSeconds: z.number().min(0).max(10),
            fadeOutSeconds: z.number().min(0).max(10),
          }),
        })
        .refine((value) => value.endSeconds > value.startSeconds, "End must be after start"),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session) throw new Error("Your session expired.");
    const supabase = getSupabaseServerClient();
    const { data: latest } = await supabase
      .from("clip_versions")
      .select("version_number")
      .eq("clip_id", data.clipId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const versionNumber = (latest?.version_number ?? 0) + 1;
    const { data: version, error } = await supabase
      .from("clip_versions")
      .insert({
        clip_id: data.clipId,
        version_number: versionNumber,
        created_by: session.id,
        created_source: "manual",
        edit_manifest_json: data.manifest,
        transcript_edits_json: { text: data.manifest.captions.text },
        caption_settings_json: data.manifest.captions,
        crop_settings_json: {
          aspectRatio: data.manifest.aspectRatio,
          cropMode: data.manifest.cropMode,
          focalPoint: data.manifest.focalPoint,
        },
        audio_settings_json: data.manifest.audio,
        text_overlays_json: [],
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: updateError } = await supabase
      .from("clips")
      .update({
        current_version_id: version.id,
        duration_seconds: data.manifest.endSeconds - data.manifest.startSeconds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.clipId);
    if (updateError) throw new Error(updateError.message);
    return { versionId: version.id, versionNumber };
  });
