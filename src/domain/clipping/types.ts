export type ClipSourceType =
  | "local_upload"
  | "direct_owned_media_url"
  | "youtube_metadata"
  | "youtube_connected_channel"
  | "youtube_download"
  | "google_drive";

export const clipJobStatuses = [
  "draft",
  "awaiting_source",
  "awaiting_authorised_source",
  "uploading",
  "queued",
  "validating",
  "creating_proxy",
  "extracting_audio",
  "transcribing",
  "analysing",
  "planning",
  "rendering_previews",
  "ready",
  "partially_ready",
  "exporting",
  "completed",
  "failed",
  "cancelled",
  "expiring",
  "expired",
] as const;
export type ClipJobStatus = (typeof clipJobStatuses)[number];

export const taskStatuses = [
  "pending",
  "queued",
  "leased",
  "running",
  "retry_wait",
  "succeeded",
  "failed",
  "cancelled",
  "dead_lettered",
  "superseded",
] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const clipTaskTypes = [
  "validate_source",
  "download_direct_source",
  "download_youtube_source",
  "create_proxy",
  "extract_audio",
  "detect_scenes",
  "split_audio",
  "transcribe_chunk",
  "merge_transcript",
  "generate_candidate_windows",
  "score_candidate_window",
  "merge_candidates",
  "render_clip_preview",
  "render_clip_export",
  "render_batch_export",
  "delete_expired_assets",
] as const;
export type ClipTaskType = (typeof clipTaskTypes)[number];
