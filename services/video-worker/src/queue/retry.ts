import type { ClipTask } from "../domain/types.js";
import { TaskFailure } from "../domain/types.js";

export type ClassifiedFailure = {
  code: string;
  message: string;
  retryable: boolean;
};

export function classifyFailure(error: unknown): ClassifiedFailure {
  if (error instanceof TaskFailure) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  const message = error instanceof Error ? error.message : "Unknown worker failure";
  const retryable = /timeout|ECONN|fetch failed|storage|rate.?limit|5\d\d/i.test(message);
  return {
    code: retryable ? "temporary_failure" : "worker_failure",
    message,
    retryable,
  };
}

export function nextAttempt(attempt: number, random = Math.random()) {
  const delay =
    Math.min(300_000, 1000 * 2 ** Math.max(0, attempt - 1)) *
    (0.75 + Math.min(1, Math.max(0, random)) * 0.5);
  return new Date(Date.now() + delay).toISOString();
}

export function failureForTaskAttempt(
  task: Pick<ClipTask, "attempt" | "max_attempts">,
  failure: ClassifiedFailure,
): ClassifiedFailure {
  if (!failure.retryable || task.attempt < task.max_attempts) return failure;

  if (failure.code === "provider_auth_challenge") {
    return {
      ...failure,
      message:
        "YouTube blocked this cloud worker after every protected download path was tried. Try again later, or use an original file or owner-controlled direct media link.",
    };
  }
  if (failure.code === "provider_rate_limited") {
    return {
      ...failure,
      message:
        "YouTube rate-limited this worker after all automatic retries. Try again later, or use an original file or owner-controlled direct media link.",
    };
  }
  return {
    ...failure,
    message: `${failure.message.replace(/\s+Vidrial will retry\.?$/i, "")} Automatic retries are exhausted.`,
  };
}
