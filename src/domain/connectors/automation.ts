export const AUTOMATION_TRIGGERS = [
  {
    id: "youtube_upload",
    connectorId: "youtube",
    label: "New YouTube upload",
    triggerType: "channel_upload",
    availability: "available",
    collectionLabel: "Channel or playlist",
  },
  {
    id: "drive_folder",
    connectorId: "google_drive",
    label: "File added to Drive folder",
    triggerType: "folder_item",
    availability: "coming_soon",
    collectionLabel: "Drive folder",
  },
  {
    id: "zoom_recording",
    connectorId: "zoom",
    label: "New Zoom recording",
    triggerType: "cloud_recording",
    availability: "coming_soon",
    collectionLabel: "Zoom account",
  },
  {
    id: "riverside_export",
    connectorId: "riverside",
    label: "New Riverside export",
    triggerType: "recording_export",
    availability: "coming_soon",
    collectionLabel: "Studio or project",
  },
  {
    id: "rss_episode",
    connectorId: "rss",
    label: "New podcast episode",
    triggerType: "rss_episode",
    availability: "coming_soon",
    collectionLabel: "RSS feed",
  },
  {
    id: "s3_prefix",
    connectorId: "s3",
    label: "Object added to S3 prefix",
    triggerType: "object_prefix",
    availability: "coming_soon",
    collectionLabel: "Bucket prefix",
  },
] as const;

export type WebhookEvent =
  | "connector.connected"
  | "connector.disconnected"
  | "import.started"
  | "import.progress"
  | "import.completed"
  | "import.failed"
  | "clip_job.started"
  | "clip_job.ready"
  | "export.ready"
  | "publication.completed"
  | "publication.failed";
