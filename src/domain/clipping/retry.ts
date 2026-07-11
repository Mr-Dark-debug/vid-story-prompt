export type RetryCategory = "rate_limit" | "provider_5xx" | "network" | "storage" | "worker_interrupted" | "lease_expired" | "invalid_media" | "unsupported_codec" | "missing_audio" | "rights" | "plan_limit" | "invalid_ai_output" | "deleted_source" | "cancelled" | "unknown";

const retryable = new Set<RetryCategory>(["rate_limit", "provider_5xx", "network", "storage", "worker_interrupted", "lease_expired"]);
export const isRetryable = (category: RetryCategory) => retryable.has(category);
export function backoffMilliseconds(attempt: number, random = Math.random()) {
  const base = Math.min(300_000, 1_000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (0.75 + Math.min(1, Math.max(0, random)) * 0.5));
}
export const isLeaseExpired = (leaseExpiresAt: string | null, now = Date.now()) => Boolean(leaseExpiresAt && new Date(leaseExpiresAt).getTime() <= now);
