import { createServerFn } from "@tanstack/react-start";
import { getServerEnv } from "@/config/env.server";

export type WorkerWakeResult = "accepted" | "failed" | "not_configured";

export type WorkerEgressHealth = {
  checkedAt: string | null;
  message: string;
  status: "healthy" | "degraded" | "blocked" | "unknown";
  tier: "protected" | "operator" | "direct" | "none";
  configuredMembers?: number;
  healthyMembers?: number;
  uniqueEgressMembers?: number;
  cobaltEnabled?: boolean;
  localRelayEnabled?: boolean;
};

type WorkerProxyHealthResponse = {
  checked_at?: unknown;
  proxy_tier?: unknown;
  status?: unknown;
  configured_members?: unknown;
  healthy_members?: unknown;
  unique_egress_members?: unknown;
  cobalt_enabled?: unknown;
  local_relay_enabled?: unknown;
};

export function mapWorkerProxyHealth(input: WorkerProxyHealthResponse): WorkerEgressHealth {
  const rawTier = typeof input.proxy_tier === "string" ? input.proxy_tier : "none";
  const tier: WorkerEgressHealth["tier"] =
    rawTier === "operator"
      ? "operator"
      : rawTier === "warp" || rawTier === "render_warp"
        ? "protected"
        : rawTier === "direct"
          ? "direct"
          : "none";
  const status: WorkerEgressHealth["status"] =
    input.status === "healthy" || input.status === "degraded" || input.status === "blocked"
      ? input.status
      : "unknown";
  const message =
    status === "healthy"
      ? tier === "operator"
        ? "The worker verified its configured private egress."
        : "The worker verified protected WARP egress and YouTube reachability."
      : status === "degraded"
        ? "The worker is reachable, but protected YouTube egress is not fully verified."
        : status === "blocked"
          ? "The worker could not verify a usable YouTube egress path."
          : "Worker egress health has not been checked yet.";
  return {
    checkedAt: typeof input.checked_at === "string" ? input.checked_at : null,
    message,
    status,
    tier,
    ...(typeof input.configured_members === "number"
      ? { configuredMembers: input.configured_members }
      : {}),
    ...(typeof input.healthy_members === "number" ? { healthyMembers: input.healthy_members } : {}),
    ...(typeof input.unique_egress_members === "number"
      ? { uniqueEgressMembers: input.unique_egress_members }
      : {}),
    ...(typeof input.cobalt_enabled === "boolean" ? { cobaltEnabled: input.cobalt_enabled } : {}),
    ...(typeof input.local_relay_enabled === "boolean"
      ? { localRelayEnabled: input.local_relay_enabled }
      : {}),
  };
}

export const getWorkerEgressHealth = createServerFn({ method: "GET" }).handler(async () => {
  const { VIDEO_WORKER_URL, WORKER_WAKE_SECRET } = getServerEnv();
  if (!VIDEO_WORKER_URL || !WORKER_WAKE_SECRET) {
    return {
      checkedAt: null,
      message: "Worker egress health is not configured for this environment.",
      status: "unknown",
      tier: "none",
    } satisfies WorkerEgressHealth;
  }
  try {
    const response = await fetch(new URL("/health/proxy", VIDEO_WORKER_URL), {
      headers: { authorization: `Bearer ${WORKER_WAKE_SECRET}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`worker_proxy_health_${response.status}`);
    return mapWorkerProxyHealth((await response.json()) as WorkerProxyHealthResponse);
  } catch {
    return {
      checkedAt: null,
      message: "The worker health check could not be reached.",
      status: "blocked",
      tier: "none",
    } satisfies WorkerEgressHealth;
  }
});

export async function wakeVideoWorker(): Promise<WorkerWakeResult> {
  const { VIDEO_WORKER_URL, WORKER_WAKE_SECRET } = getServerEnv();
  if (!VIDEO_WORKER_URL || !WORKER_WAKE_SECRET) return "not_configured";

  try {
    const response = await fetch(new URL("/wake", VIDEO_WORKER_URL), {
      headers: { authorization: `Bearer ${WORKER_WAKE_SECRET}` },
      method: "POST",
      signal: AbortSignal.timeout(8_000),
    });
    return response.status === 202 ? "accepted" : "failed";
  } catch {
    return "failed";
  }
}
