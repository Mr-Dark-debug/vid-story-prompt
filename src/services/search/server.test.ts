import { describe, expect, it } from "vitest";
import { escapeLikePattern } from "./server";

describe("escapeLikePattern", () => {
  it("escapes Postgres LIKE wildcard characters", () => {
    expect(escapeLikePattern("100%_ready\\now")).toBe("100\\%\\_ready\\\\now");
  });

  it("keeps ordinary search terms unchanged", () => {
    expect(escapeLikePattern("launch video")).toBe("launch video");
  });
});
