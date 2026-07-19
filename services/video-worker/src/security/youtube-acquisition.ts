import { TaskFailure } from "../domain/types.js";
import {
  nextAcquisitionAttempt,
  type PlannedAcquisitionAttempt,
  type PriorAcquisitionAttempt,
} from "./acquisition-plan.js";
import type { UniquePoolMember } from "./youtube-egress-pool.js";

export type AcquiredYouTubeSource = {
  bytes: number;
  filename: string;
  format: string;
  poolMemberIndex?: number;
  proxyTier: string;
  sectionApplied: boolean;
  sourceTier: "direct" | "operator_proxy" | "warp" | "cobalt";
};

type PersistedAttempt = { id: string };

type AcquisitionRunnerInput = {
  cancelled: () => boolean;
  cobaltEnabled: boolean;
  downloadCobalt: () => Promise<Omit<AcquiredYouTubeSource, "sourceTier">>;
  downloadYtdlp: (
    attempt: PlannedAcquisitionAttempt,
  ) => Promise<Omit<AcquiredYouTubeSource, "sourceTier" | "poolMemberIndex">>;
  finishAttempt: (
    id: string,
    status: "succeeded" | "failed" | "cancelled",
    error?: TaskFailure,
  ) => Promise<void>;
  operatorProxyUrl?: string;
  potProviderConfigured: boolean;
  previous: PriorAcquisitionAttempt[];
  production: boolean;
  recordAttempt: (attempt: PlannedAcquisitionAttempt, ordinal: number) => Promise<PersistedAttempt>;
  warpMembers: UniquePoolMember[];
};

const terminalFailureCodes = new Set([
  "cancelled",
  "video_private",
  "video_age_restricted",
  "video_unavailable",
  "video_region_restricted",
  "video_drm_protected",
  "unsupported_video",
  "invalid_video_id",
  "invalid_duration",
  "invalid_source_section",
  "file_too_large",
]);

function sanitizedFailure(error: unknown) {
  if (error instanceof TaskFailure) return error;
  return new TaskFailure(
    "provider_temporary_failure",
    "The configured source path was temporarily unavailable.",
    true,
  );
}

export async function acquireYouTubeSource(
  input: AcquisitionRunnerInput,
): Promise<AcquiredYouTubeSource> {
  const previous = [...input.previous];
  let ordinal = previous.length + 1;
  let lastProviderFailure: TaskFailure | null = null;

  for (;;) {
    if (input.cancelled()) {
      throw new TaskFailure("cancelled", "The YouTube acquisition job was cancelled.", false);
    }
    const planned = nextAcquisitionAttempt({
      cancelled: false,
      cobaltEnabled: input.cobaltEnabled,
      localRelayEnabled: false,
      operatorProxyUrl: input.operatorProxyUrl,
      potProviderConfigured: input.potProviderConfigured,
      previous,
      production: input.production,
      warpMembers: input.warpMembers,
    });
    if (!planned) {
      throw new TaskFailure(
        lastProviderFailure?.code ?? "provider_auth_challenge",
        "YouTube blocked every configured cloud acquisition path. Continue this job with the local helper or attach an authorised original.",
        false,
      );
    }
    if (planned.sourceTier === "local_relay") {
      throw new TaskFailure(
        "provider_auth_challenge",
        "Cloud acquisition is exhausted and this job requires the local helper.",
        false,
      );
    }

    const persisted = await input.recordAttempt(planned, ordinal);
    try {
      const result =
        planned.sourceTier === "cobalt"
          ? await input.downloadCobalt()
          : await input.downloadYtdlp(planned);
      await input.finishAttempt(persisted.id, "succeeded");
      return {
        ...result,
        sourceTier: planned.sourceTier,
        poolMemberIndex: planned.poolMemberIndex,
      };
    } catch (error) {
      const failure = sanitizedFailure(error);
      const cancelled = input.cancelled() || failure.code === "cancelled";
      await input.finishAttempt(persisted.id, cancelled ? "cancelled" : "failed", failure);
      previous.push({
        sourceTier: planned.sourceTier,
        strategy: planned.strategy,
        egressFingerprint: planned.egressFingerprint,
        status: cancelled ? "cancelled" : "failed",
      });
      ordinal += 1;
      if (cancelled || terminalFailureCodes.has(failure.code)) throw failure;
      lastProviderFailure = failure;
    }
  }
}
