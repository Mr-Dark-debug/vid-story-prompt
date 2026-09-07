import { TaskFailure } from "../domain/types.js";
import {
  nextAcquisitionAttempt,
  transientAcquisitionCodes,
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
  downloadCobalt: (
    persistedAttemptId: string,
  ) => Promise<Omit<AcquiredYouTubeSource, "sourceTier">>;
  downloadYtdlp: (
    attempt: PlannedAcquisitionAttempt,
    persistedAttemptId: string,
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
  forceProxy?: boolean;
  waitBeforeRetry?: (milliseconds: number) => Promise<void>;
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
    "provider_unknown_failure",
    "The source request failed for an unrecognized reason.",
    false,
  );
}

export function acquisitionBackoffMilliseconds(attempt: number, jitter = Math.random()) {
  return Math.round(
    Math.min(30_000, 5_000 * 2 ** Math.min(3, Math.max(0, attempt - 1))) *
      (1 + Math.min(1, Math.max(0, jitter)) * 0.2),
  );
}

async function waitForRetry(input: AcquisitionRunnerInput, milliseconds: number) {
  if (input.waitBeforeRetry) return input.waitBeforeRetry(milliseconds);
  // Keep shutdown/cancellation responsive while the existing queue heartbeat runs.
  for (let remaining = milliseconds; remaining > 0; remaining -= 250) {
    if (input.cancelled())
      throw new TaskFailure("cancelled", "The YouTube acquisition job was cancelled.", false);
    await new Promise((resolve) => setTimeout(resolve, Math.min(250, remaining)));
  }
}

export async function acquireYouTubeSource(
  input: AcquisitionRunnerInput,
): Promise<AcquiredYouTubeSource> {
  const previous = [...input.previous];
  let ordinal = previous.length + 1;
  const priorCode = previous.at(-1)?.errorCode;
  let lastProviderFailure: TaskFailure | null = priorCode
    ? new TaskFailure(
        priorCode,
        "The recorded acquisition attempts were unsuccessful.",
        transientAcquisitionCodes.has(priorCode),
      )
    : null;

  for (;;) {
    if (input.cancelled()) {
      throw new TaskFailure("cancelled", "The YouTube acquisition job was cancelled.", false);
    }
    const planned = nextAcquisitionAttempt({
      cancelled: false,
      cobaltEnabled: input.cobaltEnabled,
      operatorProxyUrl: input.operatorProxyUrl,
      potProviderConfigured: input.potProviderConfigured,
      previous,
      production: input.production,
      forceProxy: input.forceProxy,
      warpMembers: input.warpMembers,
    });
    if (!planned) {
      throw new TaskFailure(
        lastProviderFailure?.code ?? previous.at(-1)?.errorCode ?? "provider_unknown_failure",
        lastProviderFailure?.message ??
          "No unused acquisition path is available. An IP block has not been confirmed.",
        false,
      );
    }

    if (lastProviderFailure?.retryable) {
      await waitForRetry(input, acquisitionBackoffMilliseconds(ordinal - 1));
      if (input.cancelled())
        throw new TaskFailure("cancelled", "The YouTube acquisition job was cancelled.", false);
    }
    if (planned.sourceTier === "local_relay") {
      throw new TaskFailure(
        "provider_auth_challenge",
        "Cloud acquisition is exhausted. Attach an authorised original source to continue.",
        false,
      );
    }

    const persisted = await input.recordAttempt(planned, ordinal);
    try {
      const result =
        planned.sourceTier === "cobalt"
          ? await input.downloadCobalt(persisted.id)
          : await input.downloadYtdlp(planned, persisted.id);
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
        errorCode: failure.code,
      });
      ordinal += 1;
      if (cancelled || terminalFailureCodes.has(failure.code)) throw failure;
      // Unknown failures may use a different configured path, but are not
      // represented as a known transient network error or retried on this path.
      lastProviderFailure = failure;
    }
  }
}
