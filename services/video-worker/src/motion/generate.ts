import { z } from "zod";
import {
  buildMotionBriefPrompt,
  buildMotionScenePrompt,
  buildMotionRepairPrompt,
  type MotionPromptInput,
} from "./generated/prompt-builder.js";
import { lintMotionHtml } from "./generated/lint.js";
import { MOTION_LIMITS } from "./generated/contract.js";
import type { MotionAiAdapter } from "./provider.js";
const planSchema = z
  .object({
    story: z.string().min(1).max(3000),
    beats: z
      .array(
        z.object({
          time: z.number().finite().nonnegative(),
          description: z.string().min(1).max(2000),
        }),
      )
      .min(1)
      .max(60),
    keyframes: z
      .array(
        z.object({
          time: z.number().finite().nonnegative(),
          description: z.string().min(1).max(2000),
        }),
      )
      .length(4),
  })
  .strict();

export async function generateScene(
  input: MotionPromptInput,
  adapter: MotionAiAdapter,
  signal: AbortSignal,
  onStage?: (stage: "brief" | "generating" | "linting" | "repairing") => Promise<void>,
) {
  signal.throwIfAborted();
  await onStage?.("brief");
  const briefResult = await adapter.completeJson(buildMotionBriefPrompt(input), { signal });
  const brief = planSchema.safeParse(briefResult.value);
  if (
    !brief.success ||
    brief.data.beats.some((beat) => beat.time > input.spec.durationSeconds) ||
    brief.data.keyframes.some(
      (frame, index) =>
        Math.abs(frame.time - (input.spec.durationSeconds * index) / 3) >
        Math.max(0.1, 1 / input.spec.fps),
    )
  )
    throw new Error("motion_brief_invalid");
  await onStage?.("generating");
  let result = await adapter.completeText(buildMotionScenePrompt(input, brief.data), { signal });
  let tokensUsed = briefResult.tokensUsed + result.tokensUsed;
  for (let attempt = 0; attempt <= MOTION_LIMITS.maxRepairAttempts; attempt++) {
    signal.throwIfAborted();
    await onStage?.("linting");
    const htmlSource = result.text.replace(/^\s*```(?:html)?\s*\n?|\n?```\s*$/g, "").trim();
    const lintReport = lintMotionHtml(htmlSource, input.spec.durationSeconds);
    if (lintReport.ok)
      return {
        htmlSource,
        lintReport,
        modelUsed: result.modelUsed,
        tokensUsed,
        brief: brief.data,
        repairAttempts: attempt,
      };
    if (attempt === MOTION_LIMITS.maxRepairAttempts) throw new Error("motion_lint_failed");
    await onStage?.("repairing");
    result = await adapter.completeText(
      buildMotionRepairPrompt(htmlSource, lintReport, input.spec),
      { signal },
    );
    tokensUsed += result.tokensUsed;
  }
  throw new Error("motion_lint_failed");
}
