import { trackWithConsent, type AnalyticsEvent } from "@/services/analytics";
import { hasAnalyticsConsent } from "@/services/analytics/consent";

const SAFE_STRING_KEYS = new Set([
  "action",
  "category",
  "destination_host",
  "job_type",
  "method",
  "plan",
  "source",
]);
const SAFE_BOOLEAN_KEYS = new Set(["confirmation_required"]);
const SAFE_NUMBER_KEYS = new Set(["clip_count"]);

export function sanitizeAnalyticsProperties(properties: Record<string, unknown>) {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (SAFE_STRING_KEYS.has(key) && typeof value === "string" && value.length <= 80) {
      safe[key] = value;
    } else if (SAFE_BOOLEAN_KEYS.has(key) && typeof value === "boolean") {
      safe[key] = value;
    } else if (SAFE_NUMBER_KEYS.has(key) && typeof value === "number" && Number.isInteger(value)) {
      safe[key] = Math.max(0, Math.min(100, value));
    }
  }
  return safe;
}

export function trackAnalyticsEvent(
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {},
) {
  const storage = typeof window === "undefined" ? undefined : window.localStorage;
  trackWithConsent(
    hasAnalyticsConsent(storage),
    event,
    sanitizeAnalyticsProperties(properties),
  );
}
