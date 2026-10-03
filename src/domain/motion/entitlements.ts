import { PLAN_ENTITLEMENTS, type PlanKey } from "../clipping/entitlements";
import { MOTION_ASPECTS, type MotionRenderSpec } from "./types";
import { MOTION_LIMITS } from "./contract";
export function evaluateMotionEntitlement(input: {
  plan: PlanKey;
  spec: MotionRenderSpec;
  activeTasks: number;
  reservedSeconds: number;
  committedSeconds: number;
}) {
  const plan = PLAN_ENTITLEMENTS[input.plan];
  const aspect = MOTION_ASPECTS[input.spec.aspect];
  if (
    !aspect ||
    ![24, 30, 60].includes(input.spec.fps) ||
    ![
      input.spec.width,
      input.spec.height,
      input.activeTasks,
      input.reservedSeconds,
      input.committedSeconds,
    ].every(Number.isInteger) ||
    input.spec.width < 64 ||
    input.spec.height < 64 ||
    input.spec.width > 1920 ||
    input.spec.height > 1920 ||
    input.spec.width % 2 !== 0 ||
    input.spec.height % 2 !== 0 ||
    input.spec.width * input.spec.height > MOTION_LIMITS.maxPixels ||
    Math.ceil(input.spec.fps * input.spec.durationSeconds) > MOTION_LIMITS.maxFrames ||
    Math.abs(input.spec.width / input.spec.height - aspect.width / aspect.height) > 0.005
  )
    return { allowed: false as const, reason: "invalid_spec" };
  if (
    ![
      input.spec.durationSeconds,
      input.spec.width,
      input.spec.height,
      input.spec.fps,
      input.activeTasks,
      input.reservedSeconds,
      input.committedSeconds,
    ].every((n) => Number.isFinite(n) && n >= 0) ||
    input.spec.durationSeconds < 1
  )
    return { allowed: false as const, reason: "invalid_spec" };
  if (input.spec.durationSeconds > plan.maxMotionSecondsPerVideo)
    return { allowed: false as const, reason: "duration_limit" };
  const { width, height, fps } = plan.maxMotionResolution;
  if (
    Math.max(input.spec.width, input.spec.height) > Math.max(width, height) ||
    Math.min(input.spec.width, input.spec.height) > Math.min(width, height) ||
    input.spec.fps > fps
  )
    return { allowed: false as const, reason: "resolution_limit" };
  if (input.activeTasks >= plan.maxConcurrentJobs)
    return { allowed: false as const, reason: "concurrency_limit" };
  if (
    input.reservedSeconds + input.committedSeconds + Math.ceil(input.spec.durationSeconds) >
    plan.monthlyMotionRenderSeconds
  )
    return { allowed: false as const, reason: "usage_limit" };
  return { allowed: true as const, plan };
}
