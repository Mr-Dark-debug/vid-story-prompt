import { describe, expect, it } from "vitest";
import { validateTurnstileResult } from "./turnstile.server";

describe("Turnstile verification", () => {
  it("accepts a successful response for the expected action and hostname", () => {
    expect(
      validateTurnstileResult(
        { success: true, action: "signup", hostname: "vidrial.example" },
        "signup",
        "vidrial.example",
      ).success,
    ).toBe(true);
  });

  it("rejects unsuccessful, cross-action, and cross-host responses", () => {
    expect(() =>
      validateTurnstileResult(
        { success: false, action: "signup", hostname: "vidrial.example" },
        "signup",
        "vidrial.example",
      ),
    ).toThrow(/expired/i);
    expect(() =>
      validateTurnstileResult(
        { success: true, action: "youtube_metadata", hostname: "vidrial.example" },
        "signup",
        "vidrial.example",
      ),
    ).toThrow(/different action/i);
    expect(() =>
      validateTurnstileResult(
        { success: true, action: "signup", hostname: "attacker.example" },
        "signup",
        "vidrial.example",
      ),
    ).toThrow(/different website/i);
  });

  it("allows local development responses without a production hostname check", () => {
    expect(
      validateTurnstileResult(
        { success: true, action: "signup", hostname: "turnstile.test" },
        "signup",
        "localhost",
      ).success,
    ).toBe(true);
  });
});
