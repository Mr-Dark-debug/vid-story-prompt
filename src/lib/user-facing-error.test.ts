import { describe, expect, it } from "vitest";
import { userFacingError } from "./user-facing-error";

describe("userFacingError", () => {
  it("maps domain codes and structured validation to recovery copy", () => {
    expect(userFacingError(new Error("unsupported_url"), "Fallback")).toContain("valid YouTube");
    expect(userFacingError(new Error('[{"code":"too_small"}]'), "Try again")).toBe("Try again");
  });

  it("preserves useful server messages", () => {
    expect(userFacingError(new Error("This video is unavailable"), "Fallback")).toBe(
      "This video is unavailable.",
    );
  });
});
