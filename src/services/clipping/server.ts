import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";
import { wakeVideoWorker } from "@/services/worker/server";
import { getPlanEntitlement, type PlanKey } from "@/domain/clipping/entitlements";

const sourceType = z.enum([
  "local_upload",
  "direct_owned_media_url",
  "youtube_metadata",
  "youtube_connected_channel",
  "google_drive",
  "dropbox",
  "onedrive",
  "rss",
  "s3",
]);
const jobInput = z.object({
  sourceType,
  sourceUrl: z.string().url().max(2048).nullable(),
  sourceIdentifier: z.string().max(255).nullable(),
  sourceDurationSeconds: z.number().int().positive(),
  sourceAssetId: z.string().uuid().nullable(),
  connectorId: z.string().min(1).max(80).optional(),
  connectorImportId: z.string().uuid().nullable().optional(),
  sourceMetadata: z.object({
    title: z.string().max(500).optional(),
    channelId: z.string().max(255).optional(),
    channelTitle: z.string().max(500).optional(),
    thumbnailUrl: z.string().url().optional(),
  }),
  settings: z.record(z.string(), z.unknown()),
  requestedClipCount: z.number().int().min(1).max(50),
  rightsAccepted: z.literal(true),
  idempotencyKey: z.string().uuid(),
  projectId: z.string().uuid().optional(),
});

const retryTaskResult = z.object({
  taskId: z.string().uuid(),
  jobId: z.string().uuid(),
  status: z.literal("queued"),
  attempt: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  forceProxy: z.boolean().optional(),
});

const sourceRecoveryResult = z.object({
  jobId: z.string().uuid(),
  status: z.string(),
  assetId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  expectedDurationSeconds: z.coerce.number().nullable().optional(),
  actualDurationSeconds: z.coerce.number().nullable().optional(),
  matchConfidence: z.coerce.number().min(0).max(1).optional(),
  matchReason: z.string().optional(),
  idempotent: z.boolean().optional(),
});

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type AttachmentClient = {
  from(table: string): {
    insert(
      values: Record<string, unknown> | Record<string, unknown>[],
    ): PromiseLike<{ error: { message: string } | null }>;
  };
};

export const getClipJobCreationContext = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getCurrentSession();
  if (!session?.workspaceId) throw new Error("Your workspace session expired.");
  const planKey: PlanKey =
    session.plan === "creator" || session.plan === "pro" ? session.plan : "free";
  const supabase = getSupabaseServerClient();
  const [{ data: period }, { count: activeJobs }] = await Promise.all([
    supabase
      .from("usage_periods")
      .select("source_seconds_reserved,source_seconds_committed")
      .eq("workspace_id", session.workspaceId)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("clip_jobs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", session.workspaceId)
      .not("status", "in", '("completed","failed","cancelled","expiring","expired")'),
  ]);
  return {
    plan: planKey,
    entitlement: getPlanEntitlement(planKey),
    activeJobs: activeJobs ?? 0,
    reservedSeconds: Number(period?.source_seconds_reserved ?? 0),
    committedSeconds: Number(period?.source_seconds_committed ?? 0),
  };
});

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
    if (data.projectId) {
      const { error: projectError } = await getSupabaseServerClient()
        .from("clip_jobs")
        .update({ project_id: data.projectId })
        .eq("id", jobId)
        .eq("user_id", session.id);
      if (projectError) throw new Error(`Project could not be linked: ${projectError.message}`);
    }
    if (data.sourceAssetId) {
      const attachments: Record<string, unknown>[] = [
        {
          clip_job_id: jobId,
          connector_id: data.connectorId ?? data.sourceType,
          connector_import_id: data.connectorImportId ?? null,
          media_asset_id: data.sourceAssetId,
          youtube_video_id: null,
          relationship: "primary",
          match_confidence: 1,
          match_reason: "Explicitly selected by the user",
        },
      ];
      if (data.sourceType === "youtube_metadata" && data.sourceIdentifier) {
        attachments.push({
          clip_job_id: jobId,
          connector_id: "youtube",
          connector_import_id: null,
          media_asset_id: null,
          youtube_video_id: data.sourceIdentifier,
          relationship: "metadata",
          match_confidence: 1,
          match_reason: "User attached the original file to this YouTube metadata record",
        });
      }
      const attachmentClient = getSupabaseServerClient() as unknown as AttachmentClient;
      const { error: attachmentError } = await attachmentClient
        .from("source_attachments")
        .insert(attachments);
      if (attachmentError)
        throw new Error(`Source provenance could not be recorded: ${attachmentError.message}`);
    }
    const workerWake = await wakeVideoWorker();
    return { jobId, workerWake };
  });

export const listClipJobs = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getCurrentSession();
  if (!session?.workspaceId) return [];
  const { data, error } = await getSupabaseServerClient()
    .from("clip_jobs")
    .select(
      "id,project_id,source_title,source_thumbnail_url,status,requested_clip_count,completed_clip_count,created_at,retention_expires_at,error_message",
    )
    .eq("workspace_id", session.workspaceId)
    .not("status", "in", '("expiring","expired")')
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
});

export const getClipJob = createServerFn({ method: "GET" })
  .validator(z.object({ jobId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const [
      { data: job, error },
      { data: events },
      { data: clips },
      { data: exports },
      { data: tasks, error: taskError },
      { data: sourceAttachments },
      { data: connectorConnections },
    ] = await Promise.all([
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
      supabase
        .from("job_tasks")
        .select(
          "id,task_type,status,attempt,max_attempts,next_attempt_at,started_at,completed_at,error_code,error_message,progress_current,progress_total,created_at,input_json",
        )
        .eq("clip_job_id", data.jobId)
        .order("created_at", { ascending: true }),
      supabase
        .from("source_attachments")
        .select(
          "id,connector_id,connector_import_id,media_asset_id,youtube_video_id,relationship,match_confidence,match_reason,created_at",
        )
        .eq("clip_job_id", data.jobId)
        .order("created_at", { ascending: true }),
      supabase.from("oauth_connections").select("provider").eq("status", "connected"),
    ]);
    if (error) throw new Error(error.message);
    if (taskError) throw new Error(taskError.message);
    return {
      job,
      events: events ?? [],
      clips: clips ?? [],
      exports: exports ?? [],
      tasks: (tasks ?? []).map(({ input_json, ...task }) => ({
        ...task,
        force_proxy:
          typeof input_json === "object" && input_json !== null && !Array.isArray(input_json)
            ? input_json.forceProxy === true
            : false,
      })),
      sourceAttachments: sourceAttachments ?? [],
      connectedConnectorIds: (connectorConnections ?? []).map((item) =>
        item.provider === "google_youtube" ? "youtube" : item.provider,
      ),
    };
  });

export const attachSourceAndResumeClipJob = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().uuid(),
      mediaAssetId: z.string().uuid(),
      connectorId: z.enum(["local_upload", "google_drive", "dropbox", "onedrive"]),
      connectorImportId: z.string().uuid().nullable().optional(),
      idempotencyKey: z.string().uuid(),
      confirmMismatch: z.boolean().default(false),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your workspace session expired.");
    const client = getSupabaseServerClient() as unknown as RpcClient;
    const { data: result, error } = await client.rpc("attach_source_and_resume_clip_job", {
      p_job_id: data.jobId,
      p_media_asset_id: data.mediaAssetId,
      p_connector_id: data.connectorId,
      p_connector_import_id: data.connectorImportId ?? null,
      p_idempotency_key: data.idempotencyKey,
      p_confirm_mismatch: data.confirmMismatch,
    });
    if (error) {
      if (/source_exceeds_reserved_duration/i.test(error.message))
        throw new Error(
          "This file is longer than the source duration reserved for this job. Choose the matching original file.",
        );
      if (/source_asset_not_ready|connector_import_not_ready/i.test(error.message))
        throw new Error("The selected source is still importing. Wait for it to finish and retry.");
      if (/source_recovery_not_available/i.test(error.message))
        throw new Error(
          "This job no longer needs a replacement source. Refresh to see its status.",
        );
      throw new Error("The authorised source could not be attached to this job.");
    }
    const parsed = sourceRecoveryResult.parse(result);
    if (parsed.status === "queued") await wakeVideoWorker();
    return parsed;
  });

export const attachDirectSourceAndResumeClipJob = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().uuid(),
      sourceUrl: z
        .string()
        .url()
        .max(2048)
        .refine((value) => value.startsWith("https://"), {
          message: "Use an HTTPS owner-controlled media URL.",
        }),
      idempotencyKey: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your workspace session expired.");
    const client = getSupabaseServerClient() as unknown as RpcClient;
    const { data: result, error } = await client.rpc("attach_direct_source_and_resume_clip_job", {
      p_job_id: data.jobId,
      p_source_url: data.sourceUrl,
      p_idempotency_key: data.idempotencyKey,
    });
    if (error) {
      if (/source_recovery_not_available/i.test(error.message))
        throw new Error(
          "This job no longer needs a replacement source. Refresh to see its status.",
        );
      throw new Error("The owner-controlled media link could not be attached to this job.");
    }
    const parsed = sourceRecoveryResult.parse(result);
    await wakeVideoWorker();
    return parsed;
  });

export const retryClipJobTask = createServerFn({ method: "POST" })
  .validator(z.object({ jobId: z.string().uuid(), forceProxy: z.boolean().default(false) }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your workspace session expired.");
    const client = getSupabaseServerClient() as unknown as RpcClient;
    const { data: result, error } = await client.rpc("retry_clip_task", {
      p_job_id: data.jobId,
      p_force_proxy: data.forceProxy,
    });
    if (error) {
      if (/retry_not_available|retry_already_active/i.test(error.message)) {
        throw new Error("This task cannot be retried. Refresh the job to see its latest state.");
      }
      throw new Error("The failed task could not be queued again.");
    }
    const parsed = retryTaskResult.parse(result);
    const workerWake = await wakeVideoWorker();
    return { result: parsed, workerWake };
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

export const deleteClipJob = createServerFn({ method: "POST" })
  .validator(z.object({ jobId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Your workspace session expired.");
    const client = getSupabaseServerClient() as unknown as RpcClient;
    const { data: deleted, error } = await client.rpc("request_job_deletion", {
      p_job_id: data.jobId,
    });
    if (error || deleted !== true) {
      throw new Error(error?.message ?? "The clipping job could not be deleted.");
    }
    await wakeVideoWorker();
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
