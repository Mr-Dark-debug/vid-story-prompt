import type { YouTubeDownloadStrategy } from "./youtube-download.js";
import type { UniquePoolMember } from "./youtube-egress-pool.js";

export type AcquisitionSourceTier =
  | "direct"
  | "operator_proxy"
  | "warp"
  | "cobalt"
  | "local_relay";

export type PriorAcquisitionAttempt = {
  sourceTier: AcquisitionSourceTier;
  strategy?: YouTubeDownloadStrategy;
  egressFingerprint?: string;
  status: "failed" | "succeeded" | "cancelled" | "superseded";
};

export type PlannedAcquisitionAttempt = {
  sourceTier: AcquisitionSourceTier;
  strategy?: YouTubeDownloadStrategy;
  proxyUrl?: string;
  poolMemberIndex?: number;
  poolMemberId?: string;
  egressFingerprint?: string;
};

type PlanInput = {
  cancelled: boolean;
  cobaltEnabled: boolean;
  localRelayEnabled: boolean;
  operatorProxyUrl?: string;
  potProviderConfigured: boolean;
  previous: PriorAcquisitionAttempt[];
  production: boolean;
  terminalCode?: string;
  warpMembers: UniquePoolMember[];
};

const terminalCodes = new Set([
  "cancelled",
  "video_private",
  "video_age_restricted",
  "video_unavailable",
  "video_region_restricted",
  "video_drm_protected",
  "unsupported_video",
  "invalid_video_id",
  "invalid_duration",
]);

function strategies(potProviderConfigured: boolean): YouTubeDownloadStrategy[] {
  return [
    "standard",
    potProviderConfigured ? "mweb-pot" : "web-safari",
    "web-embedded",
    "android-vr",
  ];
}

function wasTried(
  previous: PriorAcquisitionAttempt[],
  tier: AcquisitionSourceTier,
  strategy?: YouTubeDownloadStrategy,
  fingerprint?: string,
) {
  return previous.some(
    (attempt) =>
      attempt.sourceTier === tier &&
      attempt.strategy === strategy &&
      attempt.egressFingerprint === fingerprint,
  );
}

export function nextAcquisitionAttempt(input: PlanInput): PlannedAcquisitionAttempt | null {
  if (input.cancelled || (input.terminalCode && terminalCodes.has(input.terminalCode))) return null;
  const clientStrategies = strategies(input.potProviderConfigured);

  if (input.operatorProxyUrl) {
    for (const strategy of clientStrategies) {
      if (!wasTried(input.previous, "operator_proxy", strategy)) {
        return { sourceTier: "operator_proxy", strategy, proxyUrl: input.operatorProxyUrl };
      }
    }
  }

  if (!input.production) {
    for (const strategy of clientStrategies) {
      if (!wasTried(input.previous, "direct", strategy)) return { sourceTier: "direct", strategy };
    }
  }

  for (const member of input.warpMembers) {
    for (const strategy of clientStrategies) {
      if (!wasTried(input.previous, "warp", strategy, member.egressFingerprint)) {
        return {
          sourceTier: "warp",
          strategy,
          proxyUrl: member.member.url,
          poolMemberIndex: member.member.index,
          poolMemberId: member.member.id,
          egressFingerprint: member.egressFingerprint,
        };
      }
    }
  }

  if (input.cobaltEnabled && !wasTried(input.previous, "cobalt")) {
    return { sourceTier: "cobalt" };
  }
  if (input.localRelayEnabled && !wasTried(input.previous, "local_relay")) {
    return { sourceTier: "local_relay" };
  }
  return null;
}
