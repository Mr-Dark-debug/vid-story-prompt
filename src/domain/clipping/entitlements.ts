export type PlanKey = "free" | "creator" | "pro";

export type PlanEntitlement = {
  key: PlanKey;
  monthlySourceSeconds: number;
  maxSourceSecondsPerJob: number;
  maxClipsPerJob: number;
  maxConcurrentJobs: number;
  maxExport: { width: number; height: number; fps: number };
  watermarkRequired: boolean;
  trialUnwatermarkedExports: number;
  retentionDays: number;
  maxRepromptsPerJob: number;
  brandPresetLimit: number;
  priority: number;
};

export const PLAN_ENTITLEMENTS: Readonly<Record<PlanKey, PlanEntitlement>> = {
  free: { key: "free", monthlySourceSeconds: 3600, maxSourceSecondsPerJob: 1800, maxClipsPerJob: 5, maxConcurrentJobs: 1, maxExport: { width: 1280, height: 720, fps: 30 }, watermarkRequired: true, trialUnwatermarkedExports: 1, retentionDays: 7, maxRepromptsPerJob: 1, brandPresetLimit: 0, priority: 10 },
  creator: { key: "creator", monthlySourceSeconds: 36000, maxSourceSecondsPerJob: 7200, maxClipsPerJob: 20, maxConcurrentJobs: 2, maxExport: { width: 1920, height: 1080, fps: 30 }, watermarkRequired: false, trialUnwatermarkedExports: 0, retentionDays: 30, maxRepromptsPerJob: 5, brandPresetLimit: 1, priority: 20 },
  pro: { key: "pro", monthlySourceSeconds: 108000, maxSourceSecondsPerJob: 21600, maxClipsPerJob: 50, maxConcurrentJobs: 4, maxExport: { width: 3840, height: 2160, fps: 60 }, watermarkRequired: false, trialUnwatermarkedExports: 0, retentionDays: 90, maxRepromptsPerJob: 20, brandPresetLimit: 5, priority: 30 },
};

export function getPlanEntitlement(key: string): PlanEntitlement {
  if (!(key in PLAN_ENTITLEMENTS)) throw new Error(`Unknown plan: ${key}`);
  return PLAN_ENTITLEMENTS[key as PlanKey];
}

export function evaluateJobEntitlement(input: { plan: PlanKey; sourceSeconds: number; requestedClips: number; activeJobs: number; reservedSeconds: number; committedSeconds: number }) {
  const plan = PLAN_ENTITLEMENTS[input.plan];
  if (input.sourceSeconds <= 0) return { allowed: false as const, reason: "invalid_duration" as const };
  if (input.sourceSeconds > plan.maxSourceSecondsPerJob) return { allowed: false as const, reason: "source_too_long" as const };
  if (input.requestedClips > plan.maxClipsPerJob) return { allowed: false as const, reason: "clip_limit" as const };
  if (input.activeJobs >= plan.maxConcurrentJobs) return { allowed: false as const, reason: "concurrent_job_limit" as const };
  if (input.reservedSeconds + input.committedSeconds + input.sourceSeconds > plan.monthlySourceSeconds) return { allowed: false as const, reason: "insufficient_usage" as const };
  return { allowed: true as const, plan };
}

export function requiresWatermark(plan: PlanKey, trialExportsUsed: number) {
  const entitlement = PLAN_ENTITLEMENTS[plan];
  return entitlement.watermarkRequired && trialExportsUsed >= entitlement.trialUnwatermarkedExports;
}
