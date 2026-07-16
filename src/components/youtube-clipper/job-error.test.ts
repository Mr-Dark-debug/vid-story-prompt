import { describe, expect, it } from "vitest";
import { PLAN_ENTITLEMENTS } from "@/domain/clipping/entitlements";
import { presentJobError } from "./job-error";

describe("presentJobError", () => {
  it("turns the database plan code into an actionable Free-plan message", () => {
    const result = presentJobError(
      new Error("plan_limit_exceeded"),
      "free",
      PLAN_ENTITLEMENTS.free,
    );

    expect(result.kind).toBe("clip-limit");
    expect(result.title).toBe("Free supports up to 5 clips per job");
    expect(result.description).not.toContain("plan_limit_exceeded");
    expect(result.upgrade).toBe(true);
  });

  it("does not expose opaque database codes for unknown errors", () => {
    const result = presentJobError(
      new Error("unexpected_rpc_failure"),
      "creator",
      PLAN_ENTITLEMENTS.creator,
    );

    expect(result.description).not.toContain("unexpected_rpc_failure");
  });
});
