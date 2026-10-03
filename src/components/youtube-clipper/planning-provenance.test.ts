import { describe, expect, it } from "vitest";
import { describePlanning, type PlanningRunInfo } from "./planning-provenance";

const run = (extra: Partial<PlanningRunInfo>): PlanningRunInfo => ({
  provider: "anthropic",
  model: "claude-opus-5",
  credential_source: "user_key",
  fallback_reason: null,
  input_token_count: 12_345,
  output_token_count: 678,
  ...extra,
});

describe("planning provenance", () => {
  it("names the user's own provider and model with token usage", () => {
    expect(describePlanning(run({}))).toEqual({
      headline: "Planned with your Anthropic key (claude-opus-5)",
      detail: null,
      tokens: "12,345 in · 678 out tokens",
      tone: "neutral",
    });
  });

  it("describes the platform and deterministic paths without implying an AI model", () => {
    expect(
      describePlanning(run({ credential_source: "platform", provider: "openrouter" })),
    ).toMatchObject({
      headline: "Planned with Vidrial's built-in model",
      tokens: null,
    });
    expect(
      describePlanning(run({ credential_source: "deterministic", provider: "deterministic" })),
    ).toMatchObject({
      headline: "Built-in selection (no AI model was used)",
      detail: null,
      tone: "neutral",
    });
  });

  it("explains every fallback reason a worker can record", () => {
    for (const reason of [
      "credential_invalid",
      "credential_missing",
      "credential_revoked",
      "context_length",
      "content_filtered",
      "quota_exceeded",
      "model_not_found",
      "rate_limited",
      "provider_unavailable",
      "timeout",
      "network",
      "invalid_output",
      "bad_request",
      "provider_rejected",
    ]) {
      const result = describePlanning(
        run({ credential_source: "deterministic", fallback_reason: reason }),
      );
      expect(result?.detail, reason).toMatch(/built-in selection was used/);
      expect(result?.tone).toBe("warning");
    }
    // An unknown code is still flagged, without inventing an explanation.
    expect(
      describePlanning(run({ credential_source: "deterministic", fallback_reason: "weird" })),
    ).toMatchObject({
      detail: null,
      tone: "warning",
    });
  });

  it("shows nothing for jobs planned before provenance existed", () => {
    expect(describePlanning(null)).toBeNull();
    expect(describePlanning(run({ credential_source: null }))).toBeNull();
  });
});
