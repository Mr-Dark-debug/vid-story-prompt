import { z } from "zod";
export const referenceMotionBriefSchema = z
  .object({
    pacing: z.enum(["slow", "measured", "energetic", "variable"]),
    cutsPerSecond: z.number().finite().min(0).max(30),
    palette: z
      .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
      .min(1)
      .max(8),
    typography: z.string().max(500),
    transitionTypes: z.array(z.string().max(100)).max(12),
    beatTimings: z.array(z.number().finite().min(0).max(60)).max(120),
    principles: z.array(z.string().max(500)).max(10),
  })
  .strict();
export type ReferenceMotionBrief = z.infer<typeof referenceMotionBriefSchema>;
