// Decides which model serves an AI feature. Pure, so the web app and the worker apply the exact
// same order and record the same provenance.
//
// Order: explicit selection for this run/thread -> the user's default for the purpose -> the
// platform fallback (only where it is available) -> deterministic, non-LLM behaviour.
import type { AiPurpose } from "./types.js";

export type ModelSelection = { credentialId: string; modelId: string };

export type CredentialSnapshot = {
  providerId: string;
  status: "active" | "invalid" | "revoked";
};

export type ResolutionInput = {
  purpose: AiPurpose;
  /** Chosen for this specific run or thread (for example in the clip wizard). */
  explicit?: ModelSelection | null;
  /** The user's saved default for this purpose. */
  preference?: ModelSelection | null;
  /** The user's credentials keyed by id. Missing ids are treated as gone. */
  credentials: ReadonlyMap<string, CredentialSnapshot>;
  /**
   * Whether the operator-provided fallback may be used. Today this is simply whether the platform
   * key and model are configured; a plan-based restriction would be applied by the caller.
   */
  platformAvailable: boolean;
};

export type SkipReason = "credential_missing" | "credential_invalid" | "credential_revoked";

export type Resolution =
  | {
      source: "user_key";
      via: "explicit" | "preference";
      credentialId: string;
      providerId: string;
      modelId: string;
      skipped: Array<{ via: "explicit" | "preference"; reason: SkipReason }>;
    }
  | { source: "platform"; skipped: Array<{ via: "explicit" | "preference"; reason: SkipReason }> }
  | {
      source: "deterministic";
      skipped: Array<{ via: "explicit" | "preference"; reason: SkipReason }>;
    };

function unusable(
  selection: ModelSelection | null | undefined,
  credentials: ReadonlyMap<string, CredentialSnapshot>,
): { ok: true; providerId: string } | { ok: false; reason: SkipReason } | null {
  if (!selection) return null;
  const credential = credentials.get(selection.credentialId);
  if (!credential) return { ok: false, reason: "credential_missing" };
  if (credential.status === "revoked") return { ok: false, reason: "credential_revoked" };
  if (credential.status === "invalid") return { ok: false, reason: "credential_invalid" };
  return { ok: true, providerId: credential.providerId };
}

export function resolveAiModel(input: ResolutionInput): Resolution {
  const skipped: Array<{ via: "explicit" | "preference"; reason: SkipReason }> = [];
  for (const via of ["explicit", "preference"] as const) {
    const selection = via === "explicit" ? input.explicit : input.preference;
    const check = unusable(selection, input.credentials);
    if (check === null) continue;
    if (check.ok) {
      return {
        source: "user_key",
        via,
        credentialId: selection!.credentialId,
        providerId: check.providerId,
        modelId: selection!.modelId,
        skipped,
      };
    }
    // A choice that cannot run is recorded, never silently hidden, before the next option is tried.
    skipped.push({ via, reason: check.reason });
  }
  return input.platformAvailable
    ? { source: "platform", skipped }
    : { source: "deterministic", skipped };
}

/** Plain-language provenance for UI and logs. Never includes a key or credential label. */
export function describeResolution(
  resolution: Pick<Resolution, "source">,
  providerLabel?: string,
  modelId?: string,
): string {
  switch (resolution.source) {
    case "user_key":
      return `Planned with your ${providerLabel ?? "provider"} key${modelId ? ` (${modelId})` : ""}`;
    case "platform":
      return "Planned with Vidrial's built-in model";
    case "deterministic":
      return "Built-in selection (no AI model was used)";
  }
}

export const CREDENTIAL_SOURCES = ["user_key", "platform", "deterministic"] as const;
export type CredentialSource = (typeof CREDENTIAL_SOURCES)[number];
