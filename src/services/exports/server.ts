import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export const requestClipExport = createServerFn({ method: "POST" })
  .validator(
    z.object({
      clipId: z.string().uuid(),
      clipVersionId: z.string().uuid(),
      captionMode: z.enum(["burned_in", "separate", "both"]).default("both"),
      idempotencyKey: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    const client = getSupabaseServerClient() as unknown as RpcClient;
    const { data: result, error } = await client.rpc("request_clip_export", {
      p_clip_id: data.clipId,
      p_clip_version_id: data.clipVersionId,
      p_export_type: "individual",
      p_caption_mode: data.captionMode,
      p_idempotency_key: data.idempotencyKey,
    });
    if (error) throw new Error(error.message);
    return z
      .object({
        exportId: z.string().uuid(),
        renderJobId: z.string().uuid(),
        watermarked: z.boolean(),
        trialConsumed: z.boolean(),
        resolution: z.string(),
      })
      .parse(result);
  });

export const listJobExports = createServerFn({ method: "GET" })
  .validator(z.object({ jobId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { data: exports, error } = await getSupabaseServerClient()
      .from("exports")
      .select("*")
      .eq("clip_job_id", data.jobId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return exports;
  });

export const getExportDownload = createServerFn({ method: "POST" })
  .validator(z.object({ exportId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session) throw new Error("Your session expired.");
    const supabase = getSupabaseServerClient();
    const { data: item, error } = await supabase
      .from("exports")
      .select("storage_bucket,storage_path,status,expires_at")
      .eq("id", data.exportId)
      .eq("user_id", session.id)
      .single();
    if (error || !item.storage_bucket || !item.storage_path || item.status !== "complete")
      throw new Error("This export is not ready for download.");
    const { data: signed, error: signError } = await supabase.storage
      .from(item.storage_bucket)
      .createSignedUrl(item.storage_path, 300, { download: true });
    if (signError) throw new Error(signError.message);
    return {
      url: signed.signedUrl,
      signedUrlExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      assetExpiresAt: item.expires_at,
    };
  });

export const requestJobDeletion = createServerFn({ method: "POST" })
  .validator(z.object({ jobId: z.string().uuid(), confirmation: z.literal("DELETE") }))
  .handler(async ({ data }) => {
    const client = getSupabaseServerClient() as unknown as RpcClient;
    const { data: result, error } = await client.rpc("request_job_deletion", {
      p_job_id: data.jobId,
    });
    if (error || !result) throw new Error(error?.message ?? "Deletion could not be queued.");
    return { ok: true };
  });

export const requestBatchExport = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().uuid(),
      clipIds: z.array(z.string().uuid()).min(1).max(50),
      idempotencyKey: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    const client = getSupabaseServerClient() as unknown as RpcClient;
    const { data: result, error } = await client.rpc("request_batch_export", {
      p_job_id: data.jobId,
      p_clip_ids: data.clipIds,
      p_idempotency_key: data.idempotencyKey,
    });
    if (error) throw new Error(error.message);
    return z
      .object({
        exportId: z.string().uuid(),
        renderJobId: z.string().uuid(),
        clipCount: z.number(),
        watermarked: z.boolean(),
      })
      .parse(result);
  });

export const listProjectExportData = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your workspace session expired.");
    const supabase = getSupabaseServerClient();
    const { data: jobs } = await supabase
      .from("clip_jobs")
      .select("id")
      .eq("project_id", data.projectId)
      .eq("workspace_id", session.workspaceId);
    const jobIds = (jobs ?? []).map((job) => job.id);
    if (!jobIds.length) return { clips: [], exports: [] };
    const [{ data: clips, error: clipError }, { data: exports, error: exportError }] =
      await Promise.all([
        supabase
          .from("clips")
          .select("id,clip_job_id,title,status,current_version_id,duration_seconds,created_at")
          .in("clip_job_id", jobIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("exports")
          .select(
            "id,clip_job_id,clip_id,format,resolution,watermarked,status,expires_at,created_at,completed_at,size_bytes",
          )
          .in("clip_job_id", jobIds)
          .order("created_at", { ascending: false }),
      ]);
    if (clipError) throw new Error(clipError.message);
    if (exportError) throw new Error(exportError.message);
    return { clips: clips ?? [], exports: exports ?? [] };
  });

export const deleteExport = createServerFn({ method: "POST" })
  .validator(z.object({ exportId: z.string().uuid(), confirmation: z.literal("DELETE") }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session) throw new Error("Your session expired.");
    const supabase = getSupabaseServerClient();
    const { data: item, error } = await supabase
      .from("exports")
      .select("storage_bucket,storage_path")
      .eq("id", data.exportId)
      .eq("user_id", session.id)
      .single();
    if (error || !item) throw new Error("That export is no longer available.");
    if (item.storage_bucket && item.storage_path) {
      const { error: storageError } = await supabase.storage
        .from(item.storage_bucket)
        .remove([item.storage_path]);
      if (storageError) throw new Error(storageError.message);
    }
    const { error: deleteError } = await supabase
      .from("exports")
      .delete()
      .eq("id", data.exportId)
      .eq("user_id", session.id);
    if (deleteError) throw new Error(deleteError.message);
    return { ok: true };
  });
