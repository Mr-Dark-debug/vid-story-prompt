import { z } from "zod";
import { MOTION_LIMITS } from "./generated/contract.js";
import { lintMotionHtml } from "./generated/lint.js";
import {
  buildMotionCritiquePrompt,
  buildMotionRepairPrompt,
  type MotionPromptInput,
} from "./generated/prompt-builder.js";
import type { MotionCritiqueReport, MotionLintReport } from "./generated/types.js";
import type { MotionAiAdapter } from "./provider.js";

const issueSchema = z
  .object({
    code: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
    description: z.string().trim().min(1).max(1000),
  })
  .strict();
const assessmentSchema = z
  .object({ issues: z.array(issueSchema).max(12), instruction: z.string().max(4000) })
  .strict();
export const motionCritiqueReportSchema = z
  .object({
    rounds: z.number().int().min(0).max(2),
    issues: z.array(issueSchema).max(16),
    resolved: z.boolean(),
  })
  .strict();
export type MotionSceneCandidate = {
  htmlSource: string;
  lintReport: MotionLintReport;
  modelUsed: string;
  tokensUsed: number;
};
export type RenderMotionKeyframes = (
  htmlSource: string,
  signal: AbortSignal,
) => Promise<readonly Buffer[]>;

function dataImages(frames: readonly Buffer[]) {
  if (frames.length !== 4) throw new Error("motion_critique_frames_invalid");
  return frames.map((frame) => {
    if (!Buffer.isBuffer(frame) || frame.length > 2_000_000)
      throw new Error("motion_critique_frames_over_limit");
    const png = frame.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = frame.length >= 3 && frame[0] === 255 && frame[1] === 216 && frame[2] === 255;
    if (!png && !jpeg) throw new Error("motion_critique_frames_invalid");
    return `data:image/${png ? "png" : "jpeg"};base64,${frame.toString("base64")}`;
  });
}
function addTokens(current: number, next: number) {
  if (!Number.isSafeInteger(next) || next < 0 || !Number.isSafeInteger(current + next))
    throw new Error("motion_provider_invalid_usage");
  return current + next;
}

/** Two bounded visual assessments. The final report always describes the delivered scene. */
export async function critiqueScene(
  input: MotionPromptInput,
  initial: MotionSceneCandidate,
  adapter: MotionAiAdapter,
  signal: AbortSignal,
  renderKeyframes: RenderMotionKeyframes,
) {
  signal.throwIfAborted();
  const initialLint = lintMotionHtml(initial.htmlSource);
  if (!initialLint.ok) throw new Error("motion_lint_failed");
  let scene: MotionSceneCandidate = {
    ...initial,
    lintReport: initialLint,
    tokensUsed: addTokens(0, initial.tokensUsed),
  };
  let issues: MotionCritiqueReport["issues"] = [];
  let rounds = 0;
  const maxRounds = Math.min(2, MOTION_LIMITS.maxCritiqueRounds);
  for (let round = 0; round < maxRounds; round++) {
    signal.throwIfAborted();
    const frames = await renderKeyframes(scene.htmlSource, signal);
    signal.throwIfAborted();
    const response = await adapter.completeJson(buildMotionCritiquePrompt(input), {
      signal,
      images: dataImages(frames),
    });
    signal.throwIfAborted();
    scene.tokensUsed = addTokens(scene.tokensUsed, response.tokensUsed);
    rounds++;
    const assessment = assessmentSchema.safeParse(response.value);
    if (!assessment.success) throw new Error("motion_critique_invalid_response");
    issues = assessment.data.issues;
    if (issues.length === 0 || round + 1 === maxRounds) break;
    const repairReport: MotionLintReport = {
      ok: false,
      errors: issues.map((issue) => ({ code: issue.code, message: issue.description })),
      warnings: [],
    };
    const prompt = buildMotionRepairPrompt(scene.htmlSource, repairReport, input.spec);
    // Model-produced advice, original user text and source remain labelled JSON data.
    const user = JSON.stringify({
      untrustedSceneRepairData: JSON.parse(prompt.user),
      userData: input,
      untrustedCritiqueInstruction: assessment.data.instruction,
    })
      .replaceAll("<", "\\u003c")
      .replaceAll(">", "\\u003e");
    const repaired = await adapter.completeText({ system: prompt.system, user }, { signal });
    signal.throwIfAborted();
    scene.tokensUsed = addTokens(scene.tokensUsed, repaired.tokensUsed);
    const htmlSource = repaired.text.replace(/^\s*```(?:html)?\s*\n?|\n?```\s*$/g, "").trim();
    const lintReport = lintMotionHtml(htmlSource);
    if (!lintReport.ok) {
      // Retain the passing version; never send a failed repair into Chromium.
      issues = [
        ...issues,
        {
          code: "critique_repair_lint_failed",
          description:
            "The suggested revision failed static checks. The last linted scene was retained.",
        },
      ];
      break;
    }
    scene = { htmlSource, lintReport, modelUsed: repaired.modelUsed, tokensUsed: scene.tokensUsed };
  }
  const critiqueReport: MotionCritiqueReport = motionCritiqueReportSchema.parse({
    rounds,
    issues,
    resolved: issues.length === 0,
  });
  return { ...scene, critiqueReport };
}
