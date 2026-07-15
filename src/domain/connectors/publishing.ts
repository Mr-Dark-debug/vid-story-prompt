import type { ConnectorAvailability } from "./types";

export type PublishingConnectorDefinition = {
  id:
    | "youtube"
    | "youtube_shorts"
    | "instagram_professional"
    | "facebook_pages"
    | "tiktok"
    | "linkedin"
    | "x"
    | "pinterest";
  label: string;
  availability: ConnectorAvailability;
  supportsScheduling: boolean;
  authentication: "oauth";
  reviewFields: readonly (
    | "video"
    | "caption"
    | "title"
    | "description"
    | "hashtags"
    | "thumbnail"
    | "target_account"
    | "scheduled_time"
  )[];
};

const fullReview = [
  "video",
  "caption",
  "title",
  "description",
  "hashtags",
  "thumbnail",
  "target_account",
  "scheduled_time",
] as const;

export const PUBLISHING_CONNECTORS: readonly PublishingConnectorDefinition[] = [
  {
    id: "youtube",
    label: "YouTube",
    availability: "available",
    supportsScheduling: true,
    authentication: "oauth",
    reviewFields: fullReview,
  },
  {
    id: "youtube_shorts",
    label: "YouTube Shorts",
    availability: "available",
    supportsScheduling: true,
    authentication: "oauth",
    reviewFields: fullReview,
  },
  {
    id: "instagram_professional",
    label: "Instagram Professional",
    availability: "coming_soon",
    supportsScheduling: false,
    authentication: "oauth",
    reviewFields: fullReview,
  },
  {
    id: "facebook_pages",
    label: "Facebook Pages",
    availability: "coming_soon",
    supportsScheduling: false,
    authentication: "oauth",
    reviewFields: fullReview,
  },
  {
    id: "tiktok",
    label: "TikTok",
    availability: "coming_soon",
    supportsScheduling: false,
    authentication: "oauth",
    reviewFields: fullReview,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    availability: "coming_soon",
    supportsScheduling: false,
    authentication: "oauth",
    reviewFields: fullReview,
  },
  {
    id: "x",
    label: "X",
    availability: "coming_soon",
    supportsScheduling: false,
    authentication: "oauth",
    reviewFields: fullReview,
  },
  {
    id: "pinterest",
    label: "Pinterest",
    availability: "coming_soon",
    supportsScheduling: false,
    authentication: "oauth",
    reviewFields: fullReview,
  },
];
