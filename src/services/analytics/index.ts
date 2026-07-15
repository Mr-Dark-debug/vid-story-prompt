export type AnalyticsEvent =
  | "youtube_clipper_viewed"
  | "url_metadata_requested"
  | "url_metadata_succeeded"
  | "url_metadata_failed"
  | "upload_started"
  | "upload_resumed"
  | "upload_completed"
  | "job_created"
  | "job_cancelled"
  | "job_failed"
  | "job_completed"
  | "partial_results_available"
  | "clip_previewed"
  | "clip_selected"
  | "clip_edited"
  | "clip_version_saved"
  | "export_requested"
  | "export_completed"
  | "export_failed"
  | "watermarked_export_downloaded"
  | "trial_export_consumed"
  | "upgrade_prompt_shown"
  | "upgrade_initiated"
  | "connector_selected"
  | "connector_waitlist_joined";
export interface AnalyticsProvider {
  track(event: AnalyticsEvent, properties: Record<string, string | number | boolean>): void;
}
let provider: AnalyticsProvider | null = null;
export const configureAnalytics = (next: AnalyticsProvider | null) => {
  provider = next;
};
export function trackWithConsent(
  consent: boolean,
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean> = {},
) {
  if (consent) provider?.track(event, properties);
}
