export const MOTION_ASPECTS = {
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
} as const;
export type MotionAspect = keyof typeof MOTION_ASPECTS;
export type MotionRenderSpec = {
  width: number;
  height: number;
  fps: 24 | 30 | 60;
  durationSeconds: number;
  aspect: MotionAspect;
};
export const MOTION_JOB_STATUSES = [
  "draft",
  "brief",
  "generating",
  "linting",
  "repairing",
  "preview_ready",
  "rendering",
  "ready",
  "failed",
  "cancelled",
] as const;
export type MotionJobStatus = (typeof MOTION_JOB_STATUSES)[number];
export type MotionLintIssue = { code: string; message: string };
export type MotionLintReport = {
  ok: boolean;
  errors: MotionLintIssue[];
  warnings: MotionLintIssue[];
};
export type MotionProject = {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  prompt: string;
  modelId: string;
  renderSpec: MotionRenderSpec;
  status: MotionJobStatus;
  createdAt: string;
  updatedAt: string;
};
export type MotionCritiqueReport = {
  rounds: number;
  issues: { code: string; description: string }[];
  resolved: boolean;
};
export type MotionVersion = {
  critiqueReport: MotionCritiqueReport | null;
  id: string;
  projectId: string;
  htmlSource: string;
  contentHash: string;
  lintReport: MotionLintReport;
  modelUsed: string | null;
  tokensUsed: number;
  parentVersionId: string | null;
  createdAt: string;
};
export type MotionRender = {
  id: string;
  projectId: string;
  versionId: string;
  status: string;
  progress: number;
  outputUrl: string | null;
  watermarked: boolean;
  errorCode: string | null;
  createdAt: string;
};
export type MotionPrompt = {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  category: string;
  tags: string[];
  aspect: MotionAspect;
  durationSeconds: number;
  recommendedModel: string | null;
  authorDisplayName: string;
  createdAt: string;
  previewUrl: string | null;
  posterUrl: string | null;
  viewCount: number;
  likeCount: number;
  copyCount: number;
  useCount: number;
  source: "official" | "community";
  status: "pending" | "approved" | "rejected";
};
const transitions: Record<MotionJobStatus, readonly MotionJobStatus[]> = {
  draft: ["brief", "generating", "preview_ready", "cancelled"],
  brief: ["generating", "failed", "cancelled"],
  generating: ["linting", "preview_ready", "failed", "cancelled"],
  linting: ["repairing", "preview_ready", "failed", "cancelled"],
  repairing: ["linting", "preview_ready", "failed", "cancelled"],
  preview_ready: ["generating", "rendering", "cancelled"],
  rendering: ["ready", "failed", "cancelled"],
  ready: ["generating", "preview_ready", "rendering", "cancelled"],
  failed: ["generating", "preview_ready", "rendering", "cancelled"],
  cancelled: ["generating", "preview_ready", "rendering"],
};
export function canTransitionMotionJob(from: MotionJobStatus, to: MotionJobStatus) {
  return from === to || transitions[from].includes(to);
}

export type ReferenceMotionBrief = {
  pacing: "slow" | "measured" | "energetic" | "variable";
  cutsPerSecond: number;
  palette: string[];
  typography: string;
  transitionTypes: string[];
  beatTimings: number[];
  principles: string[];
};
