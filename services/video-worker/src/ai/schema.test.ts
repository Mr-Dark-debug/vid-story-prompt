import { describe, expect, it } from "vitest";
import { clipCandidateSchema, clipPlanningResponseSchema } from "./schema.js";

const scores = {
  standaloneScore: 80,
  hookScore: 80,
  clarityScore: 80,
  storyScore: 80,
  relevanceScore: 80,
  technicalScore: 80,
  overallScore: 80,
};
const ai = {
  startSeconds: 0,
  endSeconds: 30,
  title: "A complete thought",
  hook: "Opening line",
  summary: "Summary",
  topic: "Topic",
  transcriptExcerpt: "Actual source excerpt.",
  ...scores,
  explanation: "Actual scoring explanation",
  socialCopy: { youtubeShorts: "Copy", instagram: "Copy", tiktok: "Copy", linkedin: "Copy" },
};

describe("candidate origins", () => {
  it("defaults existing planner payloads to AI discovery without relaxing their scores", () => {
    expect(clipCandidateSchema.parse(ai).origin).toBe("ai_discovery");
    expect(clipCandidateSchema.safeParse({ ...ai, hookScore: null }).success).toBe(false);
    expect(clipCandidateSchema.safeParse({ ...ai, hookScore: 101 }).success).toBe(false);
  });
  it.each(["manual_timestamp", "transcript_selection"] as const)(
    "represents %s without fabricated scores or transcript",
    (origin) => {
      expect(
        clipCandidateSchema.parse({ origin, startSeconds: 30, endSeconds: 45, title: "My range" }),
      ).toMatchObject({
        origin,
        hookScore: null,
        overallScore: null,
        socialCopy: null,
        transcriptExcerpt: "",
      });
      expect(
        clipCandidateSchema.safeParse({
          origin,
          startSeconds: 30,
          endSeconds: 45,
          title: "My range",
          overallScore: 0,
        }).success,
      ).toBe(false);
    },
  );
  it("rejects inverted ranges, non-finite times and unknown origins", () => {
    expect(clipCandidateSchema.safeParse({ ...ai, startSeconds: 40 }).success).toBe(false);
    expect(clipCandidateSchema.safeParse({ ...ai, endSeconds: Infinity }).success).toBe(false);
    expect(clipCandidateSchema.safeParse({ ...ai, origin: "unrecognized" }).success).toBe(false);
  });
  it("does not let the AI response schema disguise an unscored range as a planner result", () => {
    expect(
      clipPlanningResponseSchema.safeParse({
        candidates: [
          { origin: "manual_timestamp", startSeconds: 0, endSeconds: 30, title: "Not scored" },
        ],
      }).success,
    ).toBe(false);
  });
});
