import type { PlanEntitlement, PlanKey } from "@/domain/clipping/entitlements";
import type { StatusDialogVariant } from "@/components/ui/status-dialog";

export type JobErrorPresentation = {
  kind: "clip-limit" | "concurrent-limit" | "usage-limit" | "source-limit" | "generic";
  variant: StatusDialogVariant;
  title: string;
  description: string;
  upgrade: boolean;
};

export function presentJobError(
  cause: unknown,
  plan: PlanKey,
  entitlement: PlanEntitlement,
): JobErrorPresentation {
  const raw = cause instanceof Error ? cause.message : String(cause || "");
  const normalized = raw.toLowerCase();

  if (normalized.includes("plan_limit_exceeded") || normalized.includes("clip_limit")) {
    return {
      kind: "clip-limit",
      variant: "plan-limit",
      title: `${planLabel(plan)} supports up to ${entitlement.maxClipsPerJob} clips per job`,
      description: `Choose ${entitlement.maxClipsPerJob} clips or fewer for this job, or view the plans that unlock larger batches.`,
      upgrade: plan !== "pro",
    };
  }
  if (normalized.includes("concurrent_job_limit")) {
    return {
      kind: "concurrent-limit",
      variant: "pending",
      title: "Another clipping job is still processing",
      description: `Your ${planLabel(plan)} plan can process ${entitlement.maxConcurrentJobs} ${entitlement.maxConcurrentJobs === 1 ? "job" : "jobs"} at a time. Wait for an active job to finish or view upgrade options.`,
      upgrade: plan !== "pro",
    };
  }
  if (normalized.includes("insufficient_usage")) {
    return {
      kind: "usage-limit",
      variant: "plan-limit",
      title: "Not enough source minutes remain",
      description:
        "This video is longer than the source time remaining in your current billing period. Choose a shorter source or view upgrade options.",
      upgrade: plan !== "pro",
    };
  }
  if (normalized.includes("source_too_long")) {
    return {
      kind: "source-limit",
      variant: "warning",
      title: "This source is too long for the current plan",
      description: `The ${planLabel(plan)} per-job limit is ${Math.floor(entitlement.maxSourceSecondsPerJob / 60)} minutes. Choose a shorter source or view upgrade options.`,
      upgrade: plan !== "pro",
    };
  }

  return {
    kind: "generic",
    variant: "error",
    title: "The clipping job could not be created",
    description: cleanMessage(raw),
    upgrade: false,
  };
}

function planLabel(plan: PlanKey) {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function cleanMessage(raw: string) {
  if (!raw || /^[a-z0-9_]+$/i.test(raw)) {
    return "Something interrupted the request. Check the source and try again.";
  }
  return raw.replaceAll("_", " ").replace(/^error:\s*/i, "");
}
