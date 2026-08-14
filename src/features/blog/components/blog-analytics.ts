import { trackWithConsent, type AnalyticsEvent } from "@/services/analytics";

const CONSENT_KEY = "vidrial.consent.v1";

type BlogEvent = Extract<
  AnalyticsEvent,
  | "blog_view"
  | "blog_search"
  | "blog_category_filter"
  | "blog_cta_click"
  | "blog_helpful"
  | "blog_not_helpful"
  | "blog_share"
  | "blog_copy_link"
  | "related_article_click"
>;

export type BlogAnalyticsProperties = {
  slug?: string;
  category?: string;
  method?: string;
  resultCount?: number;
  hasQuery?: boolean;
};

export function hasAnalyticsConsent(storage: Pick<Storage, "getItem"> | undefined) {
  if (!storage) return false;
  try {
    const parsed = JSON.parse(storage.getItem(CONSENT_KEY) ?? "null") as {
      analytics?: unknown;
    } | null;
    return parsed?.analytics === true;
  } catch {
    return false;
  }
}

export function trackBlogEvent(event: BlogEvent, properties: BlogAnalyticsProperties = {}) {
  const storage = typeof window === "undefined" ? undefined : window.localStorage;
  trackWithConsent(hasAnalyticsConsent(storage), event, sanitizeBlogProperties(properties));
}

export function sanitizeBlogProperties(properties: Record<string, unknown>) {
  const safe: Record<string, string | number | boolean> = {};
  for (const key of ["slug", "category", "method"] as const) {
    const value = properties[key];
    if (typeof value === "string" && value.length <= 160) safe[key] = value;
  }
  if (typeof properties.resultCount === "number" && Number.isInteger(properties.resultCount)) {
    safe.resultCount = Math.max(0, Math.min(10_000, properties.resultCount));
  }
  if (typeof properties.hasQuery === "boolean") safe.hasQuery = properties.hasQuery;
  return safe;
}
