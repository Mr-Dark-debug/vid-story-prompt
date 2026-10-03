import { describe, expect, it } from "vitest";
import {
  describeResolution,
  resolveAiModel,
  type CredentialSnapshot,
  type ModelSelection,
} from "./resolution";

const creds = (entries: Record<string, CredentialSnapshot>) => new Map(Object.entries(entries));
const active = { providerId: "anthropic", status: "active" } as const;
const sel = (credentialId: string, modelId = "claude-opus-5"): ModelSelection => ({
  credentialId,
  modelId,
});

describe("AI model resolution order", () => {
  it("prefers an explicit selection over the saved default", () => {
    const result = resolveAiModel({
      purpose: "clip_planning",
      explicit: sel("explicit", "model-x"),
      preference: sel("pref"),
      credentials: creds({ explicit: { providerId: "openai", status: "active" }, pref: active }),
      platformAvailable: true,
    });
    expect(result).toMatchObject({
      source: "user_key",
      via: "explicit",
      credentialId: "explicit",
      providerId: "openai",
      modelId: "model-x",
      skipped: [],
    });
  });

  it("falls back to the saved default, then the platform, then deterministic", () => {
    const base = { purpose: "social_copy" as const, credentials: creds({ pref: active }) };
    expect(
      resolveAiModel({ ...base, preference: sel("pref"), platformAvailable: true }),
    ).toMatchObject({ source: "user_key", via: "preference" });
    expect(resolveAiModel({ ...base, platformAvailable: true })).toMatchObject({
      source: "platform",
    });
    expect(resolveAiModel({ ...base, platformAvailable: false })).toEqual({
      source: "deterministic",
      skipped: [],
    });
  });

  it("records, rather than hides, a chosen model that cannot run", () => {
    const result = resolveAiModel({
      purpose: "clip_planning",
      explicit: sel("dead"),
      preference: sel("pref"),
      credentials: creds({ dead: { providerId: "openai", status: "invalid" }, pref: active }),
      platformAvailable: false,
    });
    expect(result).toMatchObject({
      source: "user_key",
      via: "preference",
      credentialId: "pref",
      skipped: [{ via: "explicit", reason: "credential_invalid" }],
    });
  });

  it("reports why every user option was skipped when nothing is left", () => {
    const result = resolveAiModel({
      purpose: "chat",
      explicit: sel("gone"),
      preference: sel("revoked"),
      credentials: creds({ revoked: { providerId: "google", status: "revoked" } }),
      platformAvailable: false,
    });
    expect(result).toEqual({
      source: "deterministic",
      skipped: [
        { via: "explicit", reason: "credential_missing" },
        { via: "preference", reason: "credential_revoked" },
      ],
    });
  });

  it("never lets a user selection use someone else's credential", () => {
    // The caller supplies only the acting user's credentials, so a foreign id is simply missing.
    const result = resolveAiModel({
      purpose: "clip_planning",
      explicit: sel("someone-elses"),
      credentials: creds({ mine: active }),
      platformAvailable: true,
    });
    expect(result).toMatchObject({
      source: "platform",
      skipped: [{ via: "explicit", reason: "credential_missing" }],
    });
  });

  it("describes provenance without leaking identifiers", () => {
    expect(describeResolution({ source: "user_key" }, "Anthropic", "claude-opus-5")).toBe(
      "Planned with your Anthropic key (claude-opus-5)",
    );
    expect(describeResolution({ source: "platform" })).toBe(
      "Planned with Vidrial's built-in model",
    );
    expect(describeResolution({ source: "deterministic" })).toBe(
      "Built-in selection (no AI model was used)",
    );
  });
});
