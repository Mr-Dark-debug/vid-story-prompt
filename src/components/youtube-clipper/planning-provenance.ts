import { getAiProvider } from "@/domain/ai/providers";

export type PlanningRunInfo = {
  provider: string;
  model: string;
  credential_source: string | null;
  fallback_reason: string | null;
  input_token_count: number | null;
  output_token_count: number | null;
};

export type PlanningProvenance = {
  headline: string;
  detail: string | null;
  tokens: string | null;
  tone: "neutral" | "warning";
};

const FALLBACK_COPY: Record<string, string> = {
  credential_invalid:
    "Your AI key was rejected, so the built-in selection was used. Reconnect it in AI providers settings.",
  credential_missing:
    "The AI key chosen for this job is no longer available, so the built-in selection was used.",
  credential_revoked:
    "The AI key chosen for this job was revoked, so the built-in selection was used.",
  context_length:
    "Your model could not take this transcript in one request, so the built-in selection was used. A model with a larger context window may work.",
  content_filtered:
    "Your provider declined to process this transcript, so the built-in selection was used.",
  quota_exceeded:
    "Your provider account has no remaining quota or credit, so the built-in selection was used.",
  model_not_found:
    "Your provider does not offer the chosen model, so the built-in selection was used.",
  rate_limited: "Your provider kept rate limiting the request, so the built-in selection was used.",
  provider_unavailable:
    "Your provider was unavailable after several attempts, so the built-in selection was used.",
  timeout: "Your provider did not respond in time, so the built-in selection was used.",
  network: "Vidrial could not reach your provider, so the built-in selection was used.",
  invalid_output: "The model's answer could not be validated, so the built-in selection was used.",
  bad_request: "Your provider could not process the request, so the built-in selection was used.",
  provider_rejected: "The built-in model was unavailable, so the built-in selection was used.",
};

/** Honest, plain-language account of which model produced a job's plan. Null for older jobs. */
export function describePlanning(
  run: PlanningRunInfo | null | undefined,
): PlanningProvenance | null {
  if (!run || !run.credential_source) return null;
  const tokens =
    run.credential_source === "user_key" && run.output_token_count !== null
      ? `${(run.input_token_count ?? 0).toLocaleString("en")} in · ${run.output_token_count.toLocaleString("en")} out tokens`
      : null;
  switch (run.credential_source) {
    case "user_key": {
      const label = getAiProvider(run.provider)?.label ?? run.provider;
      return {
        headline: `Planned with your ${label} key (${run.model})`,
        detail: null,
        tokens,
        tone: "neutral",
      };
    }
    case "platform":
      return {
        headline: "Planned with Vidrial's built-in model",
        detail: null,
        tokens: null,
        tone: "neutral",
      };
    default:
      return {
        headline: "Built-in selection (no AI model was used)",
        detail: run.fallback_reason ? (FALLBACK_COPY[run.fallback_reason] ?? null) : null,
        tokens: null,
        tone: run.fallback_reason ? "warning" : "neutral",
      };
  }
}
