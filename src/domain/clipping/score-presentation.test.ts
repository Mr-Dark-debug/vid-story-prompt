import { describe, expect, it } from "vitest";
import { candidateScore, clipStrengthBand } from "./score-presentation";

describe("clip strength score bands", () => {
  it("never turns absent scores or user-selected ranges into a quality rating", () => {
    for (const value of [null, undefined, NaN, Infinity, "", -1, 101])
      expect(candidateScore(value)).toBeNull();
    expect(candidateScore(0, "manual_timestamp")).toBeNull();
    expect(candidateScore(90, "transcript_selection")).toBeNull();
    expect(candidateScore(0)).toBe(0);
    expect(candidateScore(79.6)).toBe(80);
  });
  it.each([
    [100, "strong"],
    [80, "strong"],
    [79, "promising"],
    [65, "promising"],
    [64, "needs_work"],
    [40, "needs_work"],
    [39, "limited"],
    [0, "limited"],
  ] as const)("maps %i to %s", (score, band) => {
    expect(clipStrengthBand(score)).toBe(band);
  });
});
