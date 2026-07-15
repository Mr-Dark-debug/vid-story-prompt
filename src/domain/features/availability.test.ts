import { describe, expect, it } from "vitest";
import { CLIPPING_FEATURES, featureIsExecutable } from "./availability";

describe("feature availability", () => {
  it("does not present planned work as executable", () => {
    expect(featureIsExecutable("subjectTracking")).toBe(false);
    expect(CLIPPING_FEATURES.directPublishing).toBe("available");
  });
});
