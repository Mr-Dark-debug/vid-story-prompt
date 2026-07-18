import { describe, expect, it } from "vitest";
import {
  getTurnstileAllowedHostnames,
  TurnstileVerificationError,
  validateTurnstileResult,
} from "./turnstile.server";

describe("Turnstile verification", () => {
  it("accepts a successful response for the expected action and hostname", () => {
    expect(
      validateTurnstileResult(
        { success: true, action: "signup", hostname: "vidrial.example" },
        "signup",
        new Set(["vidrial.example"]),
      ).success,
    ).toBe(true);
  });

  it("rejects unsuccessful, cross-action, and cross-host responses", () => {
    expect(() =>
      validateTurnstileResult(
        { success: false, action: "signup", hostname: "vidrial.example" },
        "signup",
        new Set(["vidrial.example"]),
      ),
    ).toThrow(TurnstileVerificationError);
    expect(() =>
      validateTurnstileResult(
        { success: true, action: "youtube_metadata", hostname: "vidrial.example" },
        "signup",
        new Set(["vidrial.example"]),
      ),
    ).toThrow(/different action/i);
    expect(() =>
      validateTurnstileResult(
        { success: true, action: "signup", hostname: "attacker.example" },
        "signup",
        new Set(["vidrial.example"]),
      ),
    ).toThrow(/different website/i);
  });

  it("allows local development responses without a production hostname check", () => {
    expect(
      validateTurnstileResult(
        { success: true, action: "signup", hostname: "turnstile.test" },
        "signup",
        new Set(["localhost"]),
      ).success,
    ).toBe(true);
  });

  it("accepts configured aliases and always includes the canonical hostname", () => {
    expect(
      getTurnstileAllowedHostnames(
        "https://vidrial.vercel.app",
        "vid-story-prompt.vercel.app, VIdrial.vercel.app ",
      ),
    ).toEqual(new Set(["vidrial.vercel.app", "vid-story-prompt.vercel.app"]));

    expect(
      validateTurnstileResult(
        { success: true, action: "signup", hostname: "vid-story-prompt.vercel.app" },
        "signup",
        new Set(["vidrial.vercel.app", "vid-story-prompt.vercel.app"]),
      ).success,
    ).toBe(true);
  });

  it("preserves a safe Cloudflare error code for recoverable responses", () => {
    expect.assertions(2);
    try {
      validateTurnstileResult(
        { success: false, "error-codes": ["timeout-or-duplicate"] },
        "signup",
        new Set(["vidrial.vercel.app"]),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(TurnstileVerificationError);
      expect((error as TurnstileVerificationError).code).toBe("timeout-or-duplicate");
    }
  });
});
