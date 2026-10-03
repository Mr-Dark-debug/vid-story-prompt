/** This module and the renderer entry point must never import config/env or storage. */
import { MOTION_LIMITS } from "./generated/contract.js";
import type { MotionRenderSpec } from "./generated/types.js";
export type RenderSpec = MotionRenderSpec;
export const HARD_LIMITS = Object.freeze({
  sourceBytes: MOTION_LIMITS.maxSourceBytes,
  pixels: MOTION_LIMITS.maxPixels,
  frames: MOTION_LIMITS.maxFrames,
  seconds: MOTION_LIMITS.maxDurationSeconds,
  outputBytes: 128 * 1024 * 1024,
  frameTimeoutMs: 5000,
  totalTimeoutMs: 600_000,
});
export function validateSpec(input: unknown): RenderSpec {
  if (!input || typeof input !== "object") throw new Error("motion_spec_invalid");
  const value = input as RenderSpec;
  if (
    !value ||
    ![24, 30, 60].includes(value.fps) ||
    !Number.isFinite(value.durationSeconds) ||
    value.durationSeconds < 1 ||
    value.durationSeconds > HARD_LIMITS.seconds
  )
    throw new Error("motion_spec_invalid");
  if (
    ![value.width, value.height].every(
      (n) => Number.isInteger(n) && n >= 128 && n <= 1920 && n % 2 === 0,
    ) ||
    value.width * value.height > HARD_LIMITS.pixels ||
    Math.ceil(value.fps * value.durationSeconds) > HARD_LIMITS.frames
  )
    throw new Error("motion_spec_over_limit");
  const ratio = { "16:9": 16 / 9, "1:1": 1, "9:16": 9 / 16 }[value.aspect];
  if (!ratio || Math.abs(value.width / value.height - ratio) > 0.01)
    throw new Error("motion_aspect_invalid");
  return {
    width: value.width,
    height: value.height,
    fps: value.fps,
    durationSeconds: value.durationSeconds,
    aspect: value.aspect,
  };
}
