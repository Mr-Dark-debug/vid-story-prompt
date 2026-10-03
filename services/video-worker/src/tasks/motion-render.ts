import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { env } from "../config/env.js";
import { lintMotionHtml } from "../motion/generated/lint.js";
import { validateSpec } from "../motion/limits.js";
import { withSandboxRender, type SandboxConfig } from "../motion/sandbox.js";
import { verifyOutput } from "../motion/encode.js";
import { uploadResumable } from "../storage/resumable-upload.js";
import { supabase } from "../storage/client.js";
import type { MotionClaim } from "../motion/task.js";

export const motionSandboxConfig = (): SandboxConfig => ({
  image: env.MOTION_SANDBOX_IMAGE,
  dockerPath: env.MOTION_DOCKER_PATH,
  tempRoot: env.WORKER_TEMP_ROOT,
  seccompProfile: env.MOTION_SECCOMP_PROFILE,
  memoryMb: env.MOTION_SANDBOX_MEMORY_MB,
  cpus: env.MOTION_SANDBOX_CPUS,
  pids: env.MOTION_SANDBOX_PIDS,
  timeoutMs: env.MOTION_SANDBOX_TIMEOUT_MS,
});

export async function renderMotionTask(
  task: MotionClaim,
  signal: AbortSignal,
  onProgress?: (progress: number) => void,
) {
  if (!env.WORKER_MOTION_ENABLED || !task.version || !task.render)
    throw new Error("motion_render_unavailable");
  const source = task.version.html_source;
  if (!lintMotionHtml(source).ok) throw new Error("motion_lint_failed");
  const spec = validateSpec(task.render.render_spec);
  // Derive entitlement independently from the server-side workspace owner's current plan.
  const watermark = task.plan.motion_watermark_required;
  const long = Math.max(spec.width, spec.height),
    short = Math.min(spec.width, spec.height);
  if (
    long > task.plan.max_motion_width ||
    short > task.plan.max_motion_height ||
    spec.fps > task.plan.max_motion_fps ||
    spec.durationSeconds > task.plan.max_motion_seconds_per_video
  )
    throw new Error("motion_plan_limit");
  if (task.render.watermarked !== watermark) throw new Error("motion_entitlement_changed");
  return withSandboxRender(
    source,
    spec,
    watermark,
    motionSandboxConfig(),
    async ({ output, manifest }) => {
      signal.throwIfAborted();
      const verified = await verifyOutput(
        output,
        spec,
        manifest.hasAudio === true,
        env.FFPROBE_PATH,
        signal,
      );
      const path = `${task.workspace_id}/${task.project.user_id}/${task.project_id}/motion_render/${randomUUID()}.mp4`;
      try {
        await uploadResumable({
          projectUrl: env.SUPABASE_URL,
          key: env.SUPABASE_SERVICE_ROLE_KEY,
          bucket: "motion-private",
          path,
          file: output,
          size: (await stat(output)).size,
          contentType: "video/mp4",
          signal,
        });
        signal.throwIfAborted();
        return { outputAssetPath: path, ...verified, watermarked: watermark, manifest };
      } catch (error) {
        await supabase.storage
          .from("motion-private")
          .remove([path])
          .catch(() => undefined);
        throw error;
      }
    },
    signal,
    "render",
    (progress) => onProgress?.(progress * 0.9),
  );
}
