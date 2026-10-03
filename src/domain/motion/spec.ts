import { z } from "zod";
import { MOTION_ASPECTS } from "./types";
export const motionRenderSpecSchema = z
  .object({
    width: z
      .number()
      .int()
      .min(64)
      .max(1920)
      .refine((n) => n % 2 === 0, "Width must be even"),
    height: z
      .number()
      .int()
      .min(64)
      .max(1920)
      .refine((n) => n % 2 === 0, "Height must be even"),
    fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
    durationSeconds: z.number().finite().min(1).max(60),
    aspect: z.enum(["16:9", "1:1", "9:16"]),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const preset = MOTION_ASPECTS[spec.aspect];
    if (Math.abs(spec.width / spec.height - preset.width / preset.height) > 0.005)
      ctx.addIssue({ code: "custom", message: "Dimensions must match the selected aspect ratio" });
    if (spec.width * spec.height > 1920 * 1920)
      ctx.addIssue({ code: "custom", message: "Pixel limit exceeded" });
    if (Math.ceil(spec.durationSeconds * spec.fps) > 3600)
      ctx.addIssue({ code: "custom", message: "Frame limit exceeded" });
  });
