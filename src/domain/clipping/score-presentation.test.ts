import { describe, expect, it } from "vitest";
import { clipStrengthBand } from "./score-presentation";

describe("clip strength score bands", () => {
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
