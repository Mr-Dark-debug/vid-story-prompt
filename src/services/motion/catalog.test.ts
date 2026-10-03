import { describe, expect, it } from "vitest";
import { MOTION_CATEGORIES } from "@/domain/motion/categories";
import { filterMotionPrompts, officialMotionPrompts } from "./catalog";

describe("original motion catalog", () => {
  it("provides two original briefs per canonical category without fake model provenance or metrics", () => {
    expect(officialMotionPrompts).toHaveLength(20);
    expect(new Set(officialMotionPrompts.map((p) => p.slug)).size).toBe(20);
    for (const category of MOTION_CATEGORIES)
      expect(officialMotionPrompts.filter((p) => p.category === category.slug)).toHaveLength(2);
    for (const prompt of officialMotionPrompts) {
      expect(prompt.localOriginal).toBe(true);
      expect(prompt.recommendedModel).toBeNull();
      expect([prompt.viewCount, prompt.likeCount, prompt.copyCount, prompt.useCount]).toEqual([
        0, 0, 0, 0,
      ]);
      expect(prompt.durationSeconds).toBeLessThanOrEqual(15);
    }
  });
  it("combines category, text, model and style filters instead of treating them as alternatives", () => {
    expect(
      filterMotionPrompts(officialMotionPrompts, {
        category: "data-story",
        query: "fictional",
        style: "square",
      }).map((p) => p.slug),
    ).toEqual(["a-clear-budget-picture"]);
    expect(filterMotionPrompts(officialMotionPrompts, { model: "not-configured" })).toEqual([]);
  });
  it("sorts live metrics and has deterministic ties without mutating its input", () => {
    const input = [
      { ...officialMotionPrompts[0], viewCount: 2 },
      { ...officialMotionPrompts[1], viewCount: 4 },
    ];
    expect(filterMotionPrompts(input, { sort: "views" })[0].viewCount).toBe(4);
    expect(input[0].viewCount).toBe(2);
    expect(filterMotionPrompts(officialMotionPrompts, { sort: "trending" })[0].slug).toBe(
      "a-circle-finds-its-name",
    );
  });
});
