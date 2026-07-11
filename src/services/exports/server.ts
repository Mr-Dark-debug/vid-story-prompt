import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export const requestClipExport = createServerFn({ method: "POST" })
  .validator(z.object({ clipId: z.string().uuid(), clipVersionId: z.string().uuid(), captionMode: z.enum(["burned_in", "separate", "both"]).default("both"), idempotencyKey: z.string().uuid() }))
  .handler(async ({ data }) => {
    const client = getSupabaseServerClient() as unknown as RpcClient;
    const { data: result, error } = await client.rpc("request_clip_export", { p_clip_id: data.clipId, p_clip_version_id: data.clipVersionId, p_export_type: "individual", p_caption_mode: data.captionMode, p_idempotency_key: data.idempotencyKey });
    if (error) throw new Error(error.message);
    return z.object({ exportId: z.string().uuid(), renderJobId: z.string().uuid(), watermarked: z.boolean(), trialConsumed: z.boolean(), resolution: z.string() }).parse(result);
  });

export const listJobExports = createServerFn({ method: "GET" })
  .validator(z.object({ jobId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { data: exports, error } = await getSupabaseServerClient().from("exports").select("*").eq("clip_job_id", data.jobId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return exports;
  });

export const getExportDownload = createServerFn({ method: "POST" })
  .validator(z.object({ exportId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session) throw new Error("Your session expired.");
    const supabase = getSupabaseServerClient();
    const { data: item, error } = await supabase.from("exports").select("storage_bucket,storage_path,status,expires_at").eq("id", data.exportId).eq("user_id", session.id).single();
    if (error || !item.storage_bucket || !item.storage_path || item.status !== "complete") throw new Error("This export is not ready for download.");
    const { data: signed, error: signError } = await supabase.storage.from(item.storage_bucket).createSignedUrl(item.storage_path, 300, { download: true });
    if (signError) throw new Error(signError.message);
    return { url: signed.signedUrl, signedUrlExpiresAt: new Date(Date.now() + 300_000).toISOString(), assetExpiresAt: item.expires_at };
  });

export const requestJobDeletion = createServerFn({ method: "POST" })
  .validator(z.object({ jobId: z.string().uuid(), confirmation: z.literal("DELETE") }))
  .handler(async ({ data }) => {
    const client = getSupabaseServerClient() as unknown as RpcClient;
    const { data: result, error } = await client.rpc("request_job_deletion", { p_job_id: data.jobId });
    if (error || !result) throw new Error(error?.message ?? "Deletion could not be queued.");
    return { ok: true };
  });

export const requestBatchExport = createServerFn({ method: "POST" })
  .validator(z.object({ jobId:z.string().uuid(),clipIds:z.array(z.string().uuid()).min(1).max(50),idempotencyKey:z.string().uuid() }))
  .handler(async({data})=>{const client=getSupabaseServerClient() as unknown as RpcClient;const {data:result,error}=await client.rpc("request_batch_export",{p_job_id:data.jobId,p_clip_ids:data.clipIds,p_idempotency_key:data.idempotencyKey});if(error)throw new Error(error.message);return z.object({exportId:z.string().uuid(),renderJobId:z.string().uuid(),clipCount:z.number(),watermarked:z.boolean()}).parse(result);});
