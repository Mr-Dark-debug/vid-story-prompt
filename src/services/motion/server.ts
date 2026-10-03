import { createServerFn } from "@tanstack/react-start";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";
import { getPlanEntitlement, type PlanKey } from "@/domain/clipping/entitlements";
import { motionRenderSpecSchema } from "@/domain/motion/spec";
import { lintMotionHtml } from "@/domain/motion/lint";
import { MOTION_LIMITS } from "@/domain/motion/contract";
import { referenceMotionBriefSchema } from "@/domain/motion/reference-brief";
import { isMotionCategory } from "@/domain/motion/categories";
import type {
  MotionAspect,
  MotionCritiqueReport,
  MotionJobStatus,
  MotionLintReport,
  MotionProject,
  MotionPrompt,
  MotionRender,
  MotionRenderSpec,
  MotionVersion,
} from "@/domain/motion/types";
import { getMotionClient, type MotionRow } from "./schema";
import type { SupabaseClient } from "@supabase/supabase-js";

const uuid = z.string().uuid();
const projectInput = z.object({ projectId: uuid });
const capabilitiesSchema = z.object({
  schemaVersion: z.literal(1),
  generationEnabled: z.boolean(),
  renderEnabled: z.boolean(),
  referenceEnabled: z.boolean(),
  models: z.array(z.string()),
});
async function session() {
  const value = await getCurrentSession();
  if (!value?.workspaceId) throw new Error("A signed-in workspace is required.");
  return value;
}
function row(value: unknown): MotionRow {
  return z.record(z.string(), z.unknown()).parse(value);
}
function rows(value: unknown): MotionRow[] {
  return z.array(z.record(z.string(), z.unknown())).parse(value);
}
function project(value: MotionRow): MotionProject {
  return {
    id: String(value.id),
    workspaceId: String(value.workspace_id),
    userId: String(value.user_id),
    title: String(value.title),
    prompt: String(value.prompt_text),
    modelId: String(value.model_id),
    renderSpec: value.render_spec as MotionRenderSpec,
    status: value.status as MotionJobStatus,
    createdAt: String(value.created_at),
    updatedAt: String(value.updated_at),
  };
}
function version(value: MotionRow): MotionVersion {
  return {
    critiqueReport:
      value.critique_report &&
      typeof value.critique_report === "object" &&
      "rounds" in value.critique_report
        ? (value.critique_report as MotionCritiqueReport)
        : null,
    id: String(value.id),
    projectId: String(value.project_id),
    htmlSource: String(value.html_source),
    contentHash: String(value.content_hash),
    lintReport: value.lint_report as MotionLintReport,
    modelUsed: value.model_used == null ? null : String(value.model_used),
    tokensUsed: Number(value.tokens_used),
    parentVersionId: value.parent_version_id == null ? null : String(value.parent_version_id),
    createdAt: String(value.created_at),
  };
}
function isMissingSchema(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST202";
}
async function rpc(name: string, args: Record<string, unknown>, admin = false) {
  const client = admin
    ? (getSupabaseAdminClient() as unknown as SupabaseClient)
    : getMotionClient();
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return row(data);
}
async function ownedProject(projectId: string) {
  const current = await session();
  const { data, error } = await getMotionClient()
    .from("motion_projects")
    .select("*")
    .eq("id", projectId)
    .eq("workspace_id", current.workspaceId)
    .single();
  if (error || !data) throw new Error("Motion project unavailable in this workspace.");
  return { current, project: row(data) };
}

export const getMotionCapabilities = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data, error } = await getMotionClient().rpc("motion_studio_capabilities");
    const parsed = capabilitiesSchema.safeParse(data);
    if (error || !parsed.success)
      return {
        availability: "coming_soon" as const,
        generationEnabled: false,
        renderEnabled: false,
        referenceEnabled: false,
        models: [] as { id: string; label: string; supportsVision: boolean }[],
        reason: "Motion Studio is awaiting its database deployment.",
      };
    const allowed = new Set(
      (process.env.MOTION_ALLOWED_MODELS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
    const visionModels = new Set(
      (process.env.MOTION_VISION_MODELS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
    const models = parsed.data.models
      .filter((id) => allowed.has(id))
      .map((id) => ({ id, label: id, supportsVision: visionModels.has(id) }));
    const generationEnabled =
      parsed.data.generationEnabled &&
      process.env.MOTION_GENERATION_ENABLED === "true" &&
      models.length > 0;
    const renderEnabled = parsed.data.renderEnabled && process.env.WORKER_MOTION_ENABLED === "true";
    const referenceEnabled =
      parsed.data.referenceEnabled &&
      process.env.MOTION_REFERENCE_ENABLED === "true" &&
      generationEnabled &&
      models.some((model) => visionModels.has(model.id));
    return {
      availability: "beta" as const,
      generationEnabled,
      renderEnabled,
      referenceEnabled,
      models,
      reason:
        generationEnabled && renderEnabled
          ? undefined
          : "Manual scene editing is available; generation and export require enabled worker lanes.",
    };
  } catch {
    return {
      availability: "coming_soon" as const,
      generationEnabled: false,
      renderEnabled: false,
      referenceEnabled: false,
      models: [] as { id: string; label: string; supportsVision: boolean }[],
      reason: "Motion Studio is not configured on this deployment.",
    };
  }
});
export const listMotionProjects = createServerFn({ method: "GET" }).handler(async () => {
  const current = await session();
  const { data, error } = await getMotionClient()
    .from("motion_projects")
    .select("*")
    .eq("workspace_id", current.workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (isMissingSchema(error)) return [];
  if (error) throw new Error(error.message);
  return rows(data).map(project);
});
export const getMotionProject = createServerFn({ method: "GET" })
  .validator(projectInput)
  .handler(async ({ data }) => {
    const owned = await ownedProject(data.projectId);
    const client = getMotionClient();
    const [versions, renders, tasks, referenceAnalyses] = await Promise.all([
      client
        .from("motion_versions")
        .select("*")
        .eq("project_id", data.projectId)
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("motion_renders")
        .select("*")
        .eq("project_id", data.projectId)
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("motion_tasks")
        .select("id,task_type,status,progress,error_code,created_at")
        .eq("project_id", data.projectId)
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("motion_reference_analyses")
        .select("id,media_asset_id,status,brief_json,model_used,error_code,created_at")
        .eq("project_id", data.projectId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    for (const result of [versions, renders, tasks, referenceAnalyses])
      if (result.error) throw new Error(result.error.message);
    const normalizedRenders: MotionRender[] = await Promise.all(
      rows(renders.data).map(async (value) => {
        let outputUrl: string | null = null;
        if (value.status === "ready" && value.output_asset_path) {
          const signed = await client.storage
            .from("motion-private")
            .createSignedUrl(String(value.output_asset_path), 600, { download: true });
          if (!signed.error) outputUrl = signed.data.signedUrl;
        }
        return {
          id: String(value.id),
          projectId: String(value.project_id),
          versionId: String(value.version_id),
          status: String(value.status),
          progress: Number(value.progress),
          outputUrl,
          watermarked: value.watermarked === true,
          errorCode: value.error_code == null ? null : String(value.error_code),
          createdAt: String(value.created_at),
        };
      }),
    );
    return {
      referenceAnalyses: rows(referenceAnalyses.data).map((value) => ({
        id: String(value.id),
        mediaAssetId: String(value.media_asset_id),
        status: String(value.status),
        brief: referenceMotionBriefSchema.safeParse(value.brief_json).data ?? null,
        errorCode: value.error_code == null ? null : String(value.error_code),
        modelUsed: value.model_used == null ? null : String(value.model_used),
        createdAt: String(value.created_at),
      })),
      project: project(owned.project),
      versions: rows(versions.data).map(version),
      renders: normalizedRenders,
      tasks: rows(tasks.data).map((value) => ({
        id: String(value.id),
        type: String(value.task_type),
        status: String(value.status),
        progress: Number(value.progress),
        errorCode: value.error_code == null ? null : String(value.error_code),
        createdAt: String(value.created_at),
      })),
    };
  });
export const createMotionProject = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().trim().min(1).max(160),
      prompt: z.string().min(1).max(12000),
      modelId: z.string().min(1).max(200),
      renderSpec: motionRenderSpecSchema,
      sourcePromptId: uuid.optional(),
      idempotencyKey: uuid,
    }),
  )
  .handler(async ({ data }) => {
    const current = await session();
    return z.object({ projectId: uuid }).parse(
      await rpc("create_motion_project", {
        p_workspace_id: current.workspaceId,
        p_title: data.title,
        p_prompt: data.prompt,
        p_model_id: data.modelId,
        p_render_spec: data.renderSpec,
        p_idempotency_key: data.idempotencyKey,
        p_source_prompt_id: data.sourcePromptId ?? null,
      }),
    );
  });
export const saveMotionVersion = createServerFn({ method: "POST" })
  .validator(
    z.object({
      projectId: uuid,
      htmlSource: z.string().min(1).max(MOTION_LIMITS.maxSourceBytes),
      parentVersionId: uuid.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const owned = await ownedProject(data.projectId);
    const spec = motionRenderSpecSchema.parse(owned.project.render_spec);
    const lintReport = lintMotionHtml(data.htmlSource, spec.durationSeconds);
    if (!lintReport.ok) throw new Error(lintReport.errors.map((issue) => issue.message).join(" "));
    // Service-only RPC prevents a client from claiming a fabricated passing report.
    return z.object({ versionId: uuid }).parse(
      await rpc(
        "save_motion_version",
        {
          p_project_id: data.projectId,
          p_user_id: owned.current.id,
          p_html_source: data.htmlSource,
          p_lint_report: lintReport,
          p_parent_version_id: data.parentVersionId ?? null,
        },
        true,
      ),
    );
  });
export const generateMotionVersion = createServerFn({ method: "POST" })
  .validator(
    z.object({
      projectId: uuid,
      instruction: z.string().max(4000).optional(),
      parentVersionId: uuid.optional(),
      idempotencyKey: uuid,
    }),
  )
  .handler(async ({ data }) => {
    await ownedProject(data.projectId);
    const capabilities = await getMotionCapabilities();
    if (!capabilities.generationEnabled)
      throw new Error("Generation is not enabled on this deployment.");
    return z.object({ taskId: uuid }).parse(
      await rpc("enqueue_motion_task", {
        p_project_id: data.projectId,
        p_type: "motion_generate",
        p_idempotency_key: data.idempotencyKey,
        p_payload: {
          ...(data.instruction ? { instruction: data.instruction } : {}),
          ...(data.parentVersionId ? { parentVersionId: data.parentVersionId } : {}),
        },
      }),
    );
  });
export const requestMotionRender = createServerFn({ method: "POST" })
  .validator(z.object({ projectId: uuid, versionId: uuid, idempotencyKey: uuid }))
  .handler(async ({ data }) => {
    await ownedProject(data.projectId);
    const capabilities = await getMotionCapabilities();
    if (!capabilities.renderEnabled)
      throw new Error("Rendering is not enabled on this deployment.");
    return z.object({ taskId: uuid, renderId: uuid }).parse(
      await rpc("enqueue_motion_task", {
        p_project_id: data.projectId,
        p_type: "motion_render",
        p_idempotency_key: data.idempotencyKey,
        p_version_id: data.versionId,
      }),
    );
  });
export const analyzeMotionReference = createServerFn({ method: "POST" })
  .validator(
    z.object({
      projectId: uuid,
      mediaAssetId: uuid,
      rightsAccepted: z.literal(true),
      idempotencyKey: uuid,
    }),
  )
  .handler(async ({ data }) => {
    const owned = await ownedProject(data.projectId);
    if (
      !(process.env.MOTION_VISION_MODELS ?? "")
        .split(",")
        .map((value) => value.trim())
        .includes(String(owned.project.model_id))
    )
      throw new Error("Choose a configured vision-capable model to study a reference video.");
    const capabilities = await getMotionCapabilities();
    if (!capabilities.referenceEnabled)
      throw new Error("Reference analysis is not enabled on this deployment.");
    return z.object({ taskId: uuid, referenceId: uuid }).parse(
      await rpc("enqueue_motion_task", {
        p_project_id: data.projectId,
        p_type: "motion_analyze_reference",
        p_idempotency_key: data.idempotencyKey,
        p_payload: { mediaAssetId: data.mediaAssetId, rightsAccepted: true },
      }),
    );
  });
export const cancelMotionTask = createServerFn({ method: "POST" })
  .validator(z.object({ taskId: uuid }))
  .handler(async ({ data }) => {
    await session();
    return z
      .object({ cancelled: z.boolean() })
      .parse(await rpc("cancel_motion_task", { p_task_id: data.taskId }));
  });
export const getMotionUsage = createServerFn({ method: "GET" }).handler(async () => {
  const current = await session();
  const { data, error } = await getMotionClient().rpc("get_motion_usage", {
    p_workspace_id: current.workspaceId,
  });
  if (error && !isMissingSchema(error)) throw new Error(error.message);
  const value = data ? row(data) : {};
  const plan: PlanKey = value.plan === "creator" || value.plan === "pro" ? value.plan : "free";
  const entitlement = getPlanEntitlement(plan);
  return {
    plan,
    limitSeconds: entitlement.monthlyMotionRenderSeconds,
    reservedSeconds: Number(value.reservedSeconds ?? 0),
    committedSeconds: Number(value.committedSeconds ?? 0),
    entitlement,
  };
});

function publicPrompt(value: MotionRow): MotionPrompt {
  const storage = getMotionClient().storage.from("motion-gallery");
  return {
    id: String(value.id),
    slug: String(value.slug),
    title: String(value.title),
    prompt: String(value.prompt),
    category: String(value.category),
    tags: z.array(z.string()).parse(value.tags),
    aspect: value.aspect as MotionAspect,
    durationSeconds: Number(value.duration_seconds),
    recommendedModel: value.recommended_model == null ? null : String(value.recommended_model),
    authorDisplayName: String(value.author_display_name),
    createdAt: String(value.created_at),
    previewUrl: value.preview_asset_path
      ? storage.getPublicUrl(String(value.preview_asset_path)).data.publicUrl
      : null,
    posterUrl: value.poster_path
      ? storage.getPublicUrl(String(value.poster_path)).data.publicUrl
      : null,
    viewCount: Number(value.view_count),
    likeCount: Number(value.like_count),
    copyCount: Number(value.copy_count),
    useCount: Number(value.use_count),
    source: value.source as MotionPrompt["source"],
    status: "approved",
  };
}
export const listMotionPrompts = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        category: z.string().refine(isMotionCategory).optional(),
        model: z.string().max(200).optional(),
        sort: z.enum(["trending", "views", "newest", "likes"]).default("newest"),
        limit: z.number().int().min(1).max(100).default(60),
      })
      .default({ sort: "newest", limit: 60 }),
  )
  .handler(async ({ data }) => {
    let query = getMotionClient().from("approved_motion_prompts").select("*");
    if (data.category) query = query.eq("category", data.category);
    if (data.model) query = query.eq("recommended_model", data.model);
    const column =
      data.sort === "likes"
        ? "like_count"
        : data.sort === "views"
          ? "view_count"
          : data.sort === "trending"
            ? "use_count"
            : "created_at";
    const result = await query
      .order(column, { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (isMissingSchema(result.error)) return [];
    if (result.error) throw new Error(result.error.message);
    return rows(result.data).map(publicPrompt);
  });
export const getMotionPrompt = createServerFn({ method: "GET" })
  .validator(
    z.object({
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(200),
    }),
  )
  .handler(async ({ data }) => {
    const result = await getMotionClient()
      .from("approved_motion_prompts")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (isMissingSchema(result.error)) return null;
    if (result.error) throw new Error(result.error.message);
    return result.data ? publicPrompt(row(result.data)) : null;
  });
export const recordMotionPromptEvent = createServerFn({ method: "POST" })
  .validator(
    z.object({
      promptId: uuid,
      event: z.enum(["view", "copy", "use", "like"]),
      sessionId: uuid.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const current = await getCurrentSession();
    if (data.event === "like" && !current) throw new Error("Sign in to like a prompt.");
    // Ignore caller-provided session IDs; bind deduplication to an HttpOnly session cookie.
    let sessionId = getCookies().vidrial_motion_metrics;
    if (!sessionId || !uuid.safeParse(sessionId).success) {
      sessionId = crypto.randomUUID();
      setCookie("vidrial_motion_metrics", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 86400 * 30,
      });
    }
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${current?.id ?? "anonymous"}:${sessionId}`),
    );
    const hash = Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("");
    return z.object({ ok: z.literal(true) }).parse(
      await rpc(
        "record_motion_prompt_event",
        {
          p_prompt_id: data.promptId,
          p_event: data.event,
          p_session_hash: hash,
          p_user_id: current?.id ?? null,
        },
        true,
      ),
    );
  });
export const publishMotionPrompt = createServerFn({ method: "POST" })
  .validator(
    z.object({
      projectId: uuid,
      versionId: uuid,
      title: z.string().trim().min(1).max(160),
      prompt: z.string().min(1).max(12000),
      category: z.string().refine(isMotionCategory),
      tags: z.array(z.string().max(40)).max(12).default([]),
      licenseGranted: z.literal(true),
    }),
  )
  .handler(async ({ data }) => {
    await ownedProject(data.projectId);
    return z.object({ promptId: uuid, status: z.literal("pending") }).parse(
      await rpc("publish_motion_prompt", {
        p_project_id: data.projectId,
        p_version_id: data.versionId,
        p_title: data.title,
        p_prompt: data.prompt,
        p_category: data.category,
        p_tags: data.tags,
        p_license_granted: data.licenseGranted,
      }),
    );
  });
export const reportMotionPrompt = createServerFn({ method: "POST" })
  .validator(z.object({ promptId: uuid, reason: z.string().trim().min(3).max(2000) }))
  .handler(async ({ data }) => {
    await session();
    return z
      .object({ reported: z.literal(true) })
      .parse(
        await rpc("report_motion_prompt", { p_prompt_id: data.promptId, p_reason: data.reason }),
      );
  });
