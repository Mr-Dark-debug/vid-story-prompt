import { describe, expect, it } from "vitest";
import { TaskFailure } from "../domain/types.js";
import { classifyFailure, retryAt } from "./retry.js";

describe("provider Retry-After", () => {
  it("is carried from a task failure and bounded", () => {
    expect(
      classifyFailure(new TaskFailure("ai_rate_limited", "slow", true, { retryAfterSeconds: 42 })),
    ).toMatchObject({ retryable: true, retryAfterSeconds: 42 });
    expect(
      classifyFailure(new TaskFailure("x", "y", true, { retryAfterSeconds: 999_999 }))
        .retryAfterSeconds,
    ).toBe(3_600);
    for (const bad of [0, -5, Number.NaN, "10"]) {
      expect(
        classifyFailure(new TaskFailure("x", "y", true, { retryAfterSeconds: bad })),
      ).not.toHaveProperty("retryAfterSeconds");
    }
  });

  it("never schedules a retry sooner than the provider asked, nor sooner than normal backoff", () => {
    const now = Date.parse("2026-10-03T12:00:00Z");
    // First attempt backs off about one second; the provider asked for ninety.
    expect(Date.parse(retryAt(1, { retryAfterSeconds: 90 }, now, 0.5))).toBe(now + 90_000);
    // A short Retry-After does not shorten a long exponential backoff (attempt 8 is about 128 s).
    expect(Date.parse(retryAt(8, { retryAfterSeconds: 2 }, now, 0.5))).toBeGreaterThan(now + 100_000);
    expect(Date.parse(retryAt(1, {}, now, 0.5))).toBeGreaterThanOrEqual(now);
  });
});
