import { describe, expect, it } from "vitest";
import { youtubeOAuthErrorMessage } from "./oauth-errors";
describe("YouTube OAuth error guidance", () => {
  it("separates testing restrictions from declined consent", () => {
    const message = youtubeOAuthErrorMessage("access_denied");
    expect(message).toContain("site owner must update");
    expect(message).toContain("If you declined permission");
  });
  it("does not echo arbitrary provider error text", () => {
    expect(youtubeOAuthErrorMessage("private-provider-detail")).not.toContain(
      "private-provider-detail",
    );
    expect(youtubeOAuthErrorMessage("admin_policy_enforced")).toContain("administrator");
  });
});
