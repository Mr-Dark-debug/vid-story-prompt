// Error taxonomy and secret redaction for provider calls. Nothing in here may ever carry a key.

export const AI_ERROR_CODES = [
  "invalid_key",
  "forbidden",
  "rate_limited",
  "quota_exceeded",
  "model_not_found",
  "context_length",
  "content_filtered",
  "bad_request",
  "provider_unavailable",
  "timeout",
  "network",
  "invalid_response",
  "aborted",
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

const RETRYABLE: ReadonlySet<AiErrorCode> = new Set([
  "rate_limited",
  "provider_unavailable",
  "timeout",
  "network",
]);

/** Codes that prove the stored credential itself no longer works. */
const CREDENTIAL_FAILURES: ReadonlySet<AiErrorCode> = new Set(["invalid_key", "forbidden"]);

export class AiProviderError extends Error {
  readonly code: AiErrorCode;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;
  readonly providerId: string;

  constructor(
    providerId: string,
    code: AiErrorCode,
    message: string,
    options: { status?: number | null; retryAfterSeconds?: number | null } = {},
  ) {
    super(message);
    this.name = "AiProviderError";
    this.providerId = providerId;
    this.code = code;
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }

  get retryable() {
    return RETRYABLE.has(this.code);
  }

  /** True when the credential should be marked invalid and the user asked to reconnect it. */
  get invalidatesCredential() {
    return CREDENTIAL_FAILURES.has(this.code);
  }
}

export function isAiProviderError(value: unknown): value is AiProviderError {
  return value instanceof AiProviderError;
}

const KEY_SHAPES: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /\bAIza[0-9A-Za-z_-]{20,}/g,
  /\b(?:gsk|xai|pplx|key)[_-][A-Za-z0-9_-]{16,}/g,
  /\b[A-Za-z0-9_-]{40,}\b/g,
];

/**
 * Removes exact secrets and anything shaped like a provider key from text that may be logged,
 * stored or shown. Exact matches are applied first so short custom keys are still caught.
 */
export function redactSecrets(text: string, secrets: readonly string[] = []): string {
  let output = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 6) output = output.split(secret).join("[redacted]");
  }
  for (const shape of KEY_SHAPES) output = output.replace(shape, "[redacted]");
  return output;
}

const CONTEXT_PATTERN =
  /context[_ ](?:length|window)|maximum context|prompt is too long|too many tokens|input is too long|exceeds? the (?:model'?s )?(?:maximum|limit)|token limit/i;
const FILTER_PATTERN = /content[_ ]?(?:filter|policy)|safety|blocked|moderation|refus/i;
const INVALID_KEY_PATTERN =
  /api[_ ]key (?:not valid|is invalid|invalid)|API_KEY_INVALID|invalid[_ ]api[_ ]key|incorrect api key|invalid x-api-key|no auth credentials/i;
const QUOTA_PATTERN =
  /insufficient[_ ]quota|exceeded your current quota|credit balance|billing|insufficient credits|payment required/i;

export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.ceil(seconds), 3_600);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.min(Math.max(Math.ceil((date - now) / 1_000), 0), 3_600);
}

export function extractProviderMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as unknown;
    const candidates: unknown[] = [];
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const error = record.error;
      if (typeof error === "string") candidates.push(error);
      else if (error && typeof error === "object") {
        const inner = error as Record<string, unknown>;
        candidates.push(inner.message, inner.status, inner.type, inner.code);
      }
      candidates.push(record.message);
    }
    return candidates.filter((item): item is string => typeof item === "string").join(" ");
  } catch {
    return body.slice(0, 300);
  }
}

export function classifyHttpFailure(input: {
  providerId: string;
  providerLabel: string;
  status: number;
  body: string;
  retryAfter: string | null;
  secrets: readonly string[];
}): AiProviderError {
  const detail = extractProviderMessage(input.body);
  const haystack = `${detail} ${input.body.slice(0, 600)}`;
  const { status } = input;
  let code: AiErrorCode;
  if (status === 401 || INVALID_KEY_PATTERN.test(haystack)) code = "invalid_key";
  else if (status === 402 || QUOTA_PATTERN.test(haystack)) code = "quota_exceeded";
  else if (status === 403) code = "forbidden";
  else if (status === 404) code = "model_not_found";
  else if (status === 408 || status === 504) code = "timeout";
  else if (status === 413 || (status === 400 && CONTEXT_PATTERN.test(haystack)))
    code = "context_length";
  else if (status === 429) code = "rate_limited";
  else if (status >= 500) code = "provider_unavailable";
  else if (FILTER_PATTERN.test(haystack) && status === 400) code = "content_filtered";
  else code = "bad_request";

  const safeDetail = redactSecrets(detail, input.secrets).replace(/\s+/g, " ").trim().slice(0, 200);
  const message = `${input.providerLabel} returned HTTP ${status}${safeDetail ? `: ${safeDetail}` : ""}`;
  return new AiProviderError(input.providerId, code, message, {
    status,
    retryAfterSeconds: parseRetryAfter(input.retryAfter),
  });
}

/** Copy that is safe to show a user. It never includes provider-supplied text. */
export function userMessageForAiError(code: AiErrorCode, providerLabel: string): string {
  switch (code) {
    case "invalid_key":
      return `${providerLabel} rejected this key. Reconnect it in AI providers settings.`;
    case "forbidden":
      return `${providerLabel} says this key is not allowed to do that. Check its permissions, then reconnect it.`;
    case "rate_limited":
      return `${providerLabel} is rate limiting this key. Vidrial will retry automatically where it can.`;
    case "quota_exceeded":
      return `Your ${providerLabel} account has no remaining quota or credit.`;
    case "model_not_found":
      return `${providerLabel} does not offer that model to this key. Choose another model.`;
    case "context_length":
      return "The input is longer than this model can accept. Choose a model with a larger context window or shorten the input.";
    case "content_filtered":
      return `${providerLabel} declined to answer this request.`;
    case "bad_request":
      return `${providerLabel} could not process the request.`;
    case "provider_unavailable":
      return `${providerLabel} is temporarily unavailable.`;
    case "timeout":
      return `${providerLabel} took too long to respond.`;
    case "network":
      return `Vidrial could not reach ${providerLabel}.`;
    case "invalid_response":
      return `${providerLabel} returned a response Vidrial could not read.`;
    case "aborted":
      return "The request was stopped.";
  }
}
