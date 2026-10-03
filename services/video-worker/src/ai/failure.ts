import { TaskFailure } from "../domain/types.js";
import { userMessageForAiError, type AiProviderError } from "../vendor/ai/errors.js";

/**
 * Maps a provider failure onto the queue's retry contract:
 *  - 429, 5xx, timeouts and network faults retry with backoff (honouring Retry-After);
 *  - everything else is final, with user-facing copy and no provider-supplied text.
 * A rejected key is reported as `credential_invalid` so the UI can say "reconnect your key".
 */
export function failureFromProviderError(error: AiProviderError, providerLabel: string): TaskFailure {
  const message = userMessageForAiError(error.code, providerLabel);
  if (error.retryable) {
    return new TaskFailure(
      `ai_${error.code}`,
      message,
      true,
      error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {},
    );
  }
  return new TaskFailure(
    error.invalidatesCredential ? "credential_invalid" : `ai_${error.code}`,
    message,
    false,
  );
}
