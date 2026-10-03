import { z } from "zod";
import { env } from "../config/env.js";
import { generateScene } from "./generate.js";
import { openRouterMotionAdapter, resolveAiCredential } from "./provider.js";
import { validateSpec } from "./limits.js";
import { renderMotionTask, motionSandboxConfig } from "../tasks/motion-render.js";
import { withSandboxKeyframes } from "./sandbox.js";
import { critiqueScene } from "./critique.js";
import { referenceMotionBriefSchema } from "./generated/reference-brief.js";
import { analyzeMotionReference } from "./reference.js";
import { supabase } from "../storage/client.js";

const claimSchema = z
  .object({
    id: z.string().uuid(),
    workspace_id: z.string().uuid(),
    project_id: z.string().uuid(),
    lease_token: z.string().uuid(),
    task_type: z.enum(["motion_generate", "motion_render", "motion_analyze_reference"]),
    attempt: z.number(),
    max_attempts: z.number(),
    payload_json: z.record(z.unknown()),
    project: z
      .object({
        id: z.string().uuid(),
        user_id: z.string().uuid(),
        model_id: z.string(),
        prompt_text: z.string(),
        render_spec: z.unknown(),
      })
      .passthrough(),
    plan: z
      .object({
        motion_watermark_required: z.boolean(),
        max_motion_width: z.number(),
        max_motion_height: z.number(),
        max_motion_fps: z.number(),
        max_motion_seconds_per_video: z.number(),
      })
      .passthrough(),
    version: z.object({ html_source: z.string() }).nullable(),
    parent_version: z.object({ html_source: z.string() }).nullable(),
    render: z.object({ render_spec: z.unknown(), watermarked: z.boolean() }).nullable(),
    reference: z
      .object({
        asset: z
          .object({
            storage_bucket: z.string(),
            storage_path: z.string(),
            workspace_id: z.string().uuid(),
            size_bytes: z.number(),
            duration_seconds: z.number(),
          })
          .passthrough(),
      })
      .passthrough()
      .nullable(),
    reference_brief: z.unknown().optional(),
  })
  .passthrough();
export type MotionClaim = z.infer<typeof claimSchema>;
export function parseMotionClaim(input: unknown): MotionClaim {
  return claimSchema.parse(input);
}
export function motionAdapter(task: MotionClaim, vision = false) {
  const allowed = env.MOTION_ALLOWED_MODELS.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    vision &&
    !env.MOTION_VISION_MODELS.split(",")
      .map((value) => value.trim())
      .includes(task.project.model_id)
  )
    throw new Error("motion_vision_model_unavailable");
  return openRouterMotionAdapter(
    resolveAiCredential({
      enabled: env.MOTION_GENERATION_ENABLED,
      allowedModels: allowed,
      modelId: task.project.model_id,
      platformKey: env.OPENROUTER_API_KEY,
    }),
  );
}
export async function handleMotionTask(
  task: MotionClaim,
  signal: AbortSignal,
  onProgress?: (progress: number) => void,
) {
  if (task.task_type === "motion_render") return renderMotionTask(task, signal, onProgress);
  if (task.task_type === "motion_analyze_reference") return analyzeMotionReference(task, signal);
  const spec = validateSpec(task.project.render_spec);
  const input = {
    prompt: task.project.prompt_text,
    spec,
    instruction:
      typeof task.payload_json.instruction === "string" ? task.payload_json.instruction : undefined,
    parentHtml: task.parent_version?.html_source,
    referenceBrief:
      task.reference_brief == null
        ? undefined
        : referenceMotionBriefSchema.parse(task.reference_brief),
  };
  const result = await generateScene(input, motionAdapter(task), signal, async (stage) => {
    signal.throwIfAborted();
    // Progress is cosmetic; durable status mutation is lease-fenced by a service-only RPC.
    const { data, error } = await supabase.rpc("update_motion_task_stage", {
      p_task_id: task.id,
      p_lease_token: task.lease_token,
      p_stage: stage,
    });
    if (error || data !== true) throw new Error("motion_lease_lost");
  });
  if (env.MOTION_CRITIQUE_ENABLED) {
    const assessed = await critiqueScene(
      input,
      result,
      motionAdapter(task, true),
      signal,
      (source, frameSignal) =>
        withSandboxKeyframes(source, spec, motionSandboxConfig(), frameSignal),
    );
    return {
      htmlSource: assessed.htmlSource,
      lintReport: assessed.lintReport,
      modelUsed: assessed.modelUsed,
      tokensUsed: assessed.tokensUsed,
      critiqueReport: assessed.critiqueReport,
    };
  }
  return {
    htmlSource: result.htmlSource,
    lintReport: result.lintReport,
    modelUsed: result.modelUsed,
    tokensUsed: result.tokensUsed,
  };
}
