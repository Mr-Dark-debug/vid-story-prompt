import { mkdir } from "node:fs/promises";
import { env } from "../config/env.js";
import { supabase } from "../storage/client.js";
import { parseTaskCapabilities, MOTION_TASK_TYPES } from "../queue/task-capabilities.js";
import { handleMotionTask, parseMotionClaim, type MotionClaim } from "./task.js";
import { logger } from "../logging/logger.js";
import { verifyMotionHost } from "./preflight.js";
import { motionSandboxConfig } from "../tasks/motion-render.js";

/** Trusted controller role; Chromium is only launched in the credential-free Docker job. */
const shutdown = new AbortController();
if (!env.WORKER_MOTION_ENABLED)
  throw new Error("Motion controller requires WORKER_MOTION_ENABLED=true.");
const capabilities = parseTaskCapabilities(
  env.WORKER_TASK_INCLUDE_TYPES,
  env.WORKER_TASK_EXCLUDE_TYPES,
);
const include = MOTION_TASK_TYPES.filter(
  (type) =>
    (!capabilities.include || capabilities.include.includes(type)) &&
    !capabilities.exclude.includes(type),
);
if (!include.length) throw new Error("Motion controller has no task capabilities.");
await mkdir(env.WORKER_TEMP_ROOT, { recursive: true });
for (const name of ["SIGTERM", "SIGINT"] as const) process.on(name, () => shutdown.abort());
try {
  env.MOTION_SANDBOX_IMAGE = await verifyMotionHost(motionSandboxConfig(), shutdown.signal);
  logger.info(
    { rendererImage: env.MOTION_SANDBOX_IMAGE },
    "Motion sandbox verified; controller may claim jobs",
  );
} catch {
  logger.fatal(
    { errorCode: "motion_host_verification_failed" },
    "Motion controller cannot start; verify the dedicated Linux Docker host",
  );
  process.exit(1);
}

async function processTask(task: MotionClaim) {
  const controller = new AbortController();
  const signal = AbortSignal.any([shutdown.signal, controller.signal]);
  let renewing = false;
  let progress = 0;
  const heartbeat = async () => {
    if (renewing || signal.aborted) return;
    renewing = true;
    try {
      const result = await supabase.rpc("heartbeat_motion_task", {
        p_task_id: task.id,
        p_lease_token: task.lease_token,
        p_progress: progress,
      });
      if (result.error || result.data?.cancelled !== false)
        controller.abort(new Error("motion_lease_lost"));
    } catch {
      controller.abort(new Error("motion_lease_lost"));
    } finally {
      renewing = false;
    }
  };
  const timer = setInterval(() => void heartbeat(), 5000);
  let uploadedPath: string | undefined;
  let completionUncertain = false;
  try {
    const output = await handleMotionTask(task, signal, (next) => {
      progress = Math.max(progress, next);
    });
    if ("outputAssetPath" in output && typeof output.outputAssetPath === "string")
      uploadedPath = output.outputAssetPath;
    signal.throwIfAborted();
    completionUncertain = true;
    const result = await supabase.rpc("complete_motion_task", {
      p_task_id: task.id,
      p_lease_token: task.lease_token,
      p_result: output,
    });
    if (!result.error) completionUncertain = false;
    if (result.error || result.data !== true) throw new Error("motion_lease_lost");
    uploadedPath = undefined;
    logger.info({ taskId: task.id, taskType: task.task_type }, "Motion task completed");
  } catch (error) {
    if (completionUncertain) {
      // A lost RPC response may follow a committed transaction. Never delete an
      // object that could already back a ready render; lease recovery reconciles
      // the queue. Unreferenced immutable uploads can be garbage-collected later.
      logger.warn(
        { taskId: task.id, taskType: task.task_type, errorCode: "motion_completion_uncertain" },
        "Motion completion requires reconciliation",
      );
      return;
    }
    const code = signal.aborted
      ? "motion_cancelled"
      : error instanceof Error && /^motion_[a-z_]+$/.test(error.message)
        ? error.message
        : "motion_task_failed";
    const retryable =
      [
        "motion_browser_failed",
        "motion_sandbox_failed",
        "motion_provider_rate_limit",
        "motion_provider_unavailable",
      ].includes(code) && task.attempt < 2;
    await supabase.rpc("fail_motion_task", {
      p_task_id: task.id,
      p_lease_token: task.lease_token,
      p_error_code: code,
      p_retryable: retryable,
    });
    if (uploadedPath)
      await supabase.storage
        .from("motion-private")
        .remove([uploadedPath])
        .catch(() => undefined);
    logger.warn(
      { taskId: task.id, taskType: task.task_type, errorCode: code, retryable },
      "Motion task stopped",
    );
  } finally {
    clearInterval(timer);
    controller.abort();
  }
}

while (!shutdown.signal.aborted) {
  try {
    const result = await supabase.rpc("claim_motion_task", {
      p_worker_id: env.WORKER_ID,
      p_include_types: include,
      p_lease_seconds: 90,
    });
    if (result.error) throw new Error("motion_queue_unavailable");
    if (result.data) await processTask(parseMotionClaim(result.data));
    else
      await new Promise<void>((resolve) => {
        const timer = setTimeout(done, env.QUEUE_POLL_INTERVAL_MS);
        function done() {
          clearTimeout(timer);
          shutdown.signal.removeEventListener("abort", done);
          resolve();
        }
        shutdown.signal.addEventListener("abort", done, { once: true });
      });
  } catch {
    logger.warn({ errorCode: "motion_queue_unavailable" }, "Motion queue polling failed");
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(10_000, env.QUEUE_POLL_INTERVAL_MS * 2)),
    );
  }
}
