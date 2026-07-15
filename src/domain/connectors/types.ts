export const CONNECTOR_CATEGORIES = [
  "video_platforms",
  "cloud_storage",
  "recording_platforms",
  "podcast_audio",
  "direct_links",
  "developer_automation",
  "uploads",
  "other",
] as const;

export type ConnectorCategory = (typeof CONNECTOR_CATEGORIES)[number];
export type ConnectorAvailability = "available" | "beta" | "coming_soon" | "disabled";
export type ConnectorAuthentication = "none" | "oauth" | "api_key" | "signed_url";
export type ConnectorCapability =
  | "metadata"
  | "browse"
  | "search"
  | "download_original"
  | "resumable_import"
  | "captions"
  | "playlist"
  | "channel_automation"
  | "webhook"
  | "publish"
  | "schedule";

export type ConnectorIcon =
  | "upload"
  | "youtube"
  | "cloud"
  | "link"
  | "podcast"
  | "video"
  | "recording"
  | "database"
  | "automation"
  | "folder"
  | "message"
  | "other";

export type ConnectorDefinition = {
  id: string;
  label: string;
  description: string;
  category: ConnectorCategory;
  availability: ConnectorAvailability;
  capabilities: readonly ConnectorCapability[];
  authentication: ConnectorAuthentication;
  icon: ConnectorIcon;
  requiresRightsConfirmation: boolean;
  requiresOriginalSource: boolean;
  supportsPublicLinks: boolean;
  documentationUrl?: string;
  featureFlag?: string;
  searchTerms?: readonly string[];
};

export type PublicConnectorDefinition = Readonly<ConnectorDefinition> & {
  connected: boolean;
  executable: boolean;
  configured: boolean;
};

export type RemoteMediaAsset = {
  id: string;
  name: string;
  kind: "video" | "audio" | "caption" | "transcript";
  mimeType: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  modifiedAt: string | null;
  thumbnailUrl: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

export type PaginatedAssets = {
  assets: RemoteMediaAsset[];
  nextCursor: string | null;
};

export type ImportProgress = {
  status: "queued" | "connecting" | "transferring" | "verifying" | "ready" | "failed" | "cancelled";
  bytesTransferred: number;
  bytesTotal: number | null;
  errorCode?: string;
};

export interface MediaConnector {
  definition: ConnectorDefinition;
  connect?(input: { returnTo: string }): Promise<{ connectionId?: string; redirectUrl?: string }>;
  disconnect?(connectionId: string): Promise<void>;
  refreshConnection?(connectionId: string): Promise<void>;
  resolveUrl?(input: { url: string }): Promise<RemoteMediaAsset>;
  listAssets?(input: {
    connectionId: string;
    cursor?: string;
    collectionId?: string;
  }): Promise<PaginatedAssets>;
  searchAssets?(input: {
    connectionId: string;
    query: string;
    cursor?: string;
  }): Promise<PaginatedAssets>;
  getAsset?(input: { connectionId: string; assetId: string }): Promise<RemoteMediaAsset>;
  createImport?(input: {
    connectionId?: string;
    assetId?: string;
    url?: string;
    idempotencyKey: string;
  }): Promise<{ importId: string }>;
  pollImport?(input: { importId: string }): Promise<ImportProgress>;
  cancelImport?(input: { importId: string }): Promise<void>;
  testConnection?(connectionId: string): Promise<{ healthy: boolean; checkedAt: string }>;
}

export interface PublishingConnector {
  definition: ConnectorDefinition;
  connect(input: { returnTo: string }): Promise<{ redirectUrl: string }>;
  publish(input: {
    exportId: string;
    title: string;
    description: string;
    hashtags: string[];
    thumbnailAssetId?: string;
    targetConnectionId: string;
  }): Promise<{ publicationId: string; status: string }>;
  schedule?(input: { publicationId: string; scheduledFor: string }): Promise<{ status: string }>;
  refreshStatus?(publicationId: string): Promise<{ status: string }>;
  deleteScheduled?(publicationId: string): Promise<void>;
}

export const CATEGORY_LABELS: Readonly<Record<ConnectorCategory, string>> = {
  video_platforms: "Video platforms",
  cloud_storage: "Cloud storage",
  recording_platforms: "Recording platforms",
  podcast_audio: "Podcast and audio",
  direct_links: "Direct links",
  developer_automation: "Developer and automation",
  uploads: "Uploads",
  other: "Other",
};
