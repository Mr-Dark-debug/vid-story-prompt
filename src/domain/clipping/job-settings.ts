import { z } from "zod";
import { validateExactCutRanges } from "./exact-cut";

const manualSettings = z.object({
  mode: z.literal("manual_timestamp"),
  ranges: z.array(
    z.object({
      label: z.string().trim().max(120).optional(),
      startSeconds: z.number().nonnegative(),
      endSeconds: z.number().positive(),
    }),
  ),
  captionsRequested: z.literal(false).default(false),
});

export function prepareClipJobSettings(
  settings: Record<string, unknown>,
  context: { sourceSeconds: number; requestedClips: number; maximumClips: number },
) {
  if (settings.mode === undefined || settings.mode === "ai_discovery") return settings;
  const manual = manualSettings.parse(settings);
  const validation = validateExactCutRanges(
    manual.ranges.map((range) => ({
      label: range.label ?? "",
      start: String(range.startSeconds),
      end: String(range.endSeconds),
    })),
    {
      sourceSeconds: context.sourceSeconds,
      maximumClips: context.maximumClips,
      remainingSeconds: Number.MAX_SAFE_INTEGER,
    },
  );
  if (!validation.valid || manual.ranges.length !== context.requestedClips)
    throw new Error("invalid_clip_ranges");
  return { ...manual, ranges: validation.ranges };
}
