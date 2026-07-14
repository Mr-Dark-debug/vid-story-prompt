const authDiagnosticStages = ["google_begin", "oauth_exchange"] as const;
type AuthDiagnosticStage = (typeof authDiagnosticStages)[number];

type SafeAuthDiagnostic = {
  stage: AuthDiagnosticStage;
  provider: "google";
  code?: string;
  status?: number;
};

function recordValue(value: unknown, key: string) {
  return typeof value === "object" && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

export function safeAuthDiagnostic(
  stage: AuthDiagnosticStage,
  error: unknown,
): SafeAuthDiagnostic {
  const diagnostic: SafeAuthDiagnostic = { stage, provider: "google" };
  const code = recordValue(error, "code");
  const status = recordValue(error, "status");
  if (typeof code === "string" && /^[a-z0-9_.-]{1,80}$/i.test(code)) diagnostic.code = code;
  if (typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599)
    diagnostic.status = status;
  return diagnostic;
}

export function logAuthFailure(stage: AuthDiagnosticStage, error: unknown) {
  console.error("auth_operation_failed", safeAuthDiagnostic(stage, error));
}
