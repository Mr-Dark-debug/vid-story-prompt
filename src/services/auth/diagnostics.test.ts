import { describe, expect, it } from "vitest";
import { safeAuthDiagnostic } from "./diagnostics";

describe("OAuth diagnostics", () => {
  it("keeps only fixed metadata suitable for production logs", () => {
    const diagnostic = safeAuthDiagnostic("oauth_exchange", {
      code: "bad_oauth_state",
      status: 400,
      message: "Unable to exchange external code 4/0A-secret-code",
      access_token: "private-token",
    });

    expect(diagnostic).toEqual({
      stage: "oauth_exchange",
      provider: "google",
      code: "bad_oauth_state",
      status: 400,
    });
    expect(JSON.stringify(diagnostic)).not.toContain("4/0A");
    expect(JSON.stringify(diagnostic)).not.toContain("private-token");
  });

  it("drops untrusted error codes and invalid statuses", () => {
    expect(
      safeAuthDiagnostic("google_begin", {
        code: "secret code with spaces",
        status: 900,
      }),
    ).toEqual({ stage: "google_begin", provider: "google" });
  });
});
