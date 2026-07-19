import { describe, expect, it } from "vitest";
import { nextAcquisitionAttempt, type PriorAcquisitionAttempt } from "./acquisition-plan.js";

const warpMembers = [
  {
    duplicateMemberIndices: [],
    egressFingerprint: "fingerprint-a",
    member: { id: "warp-0", index: 0, url: "http://warp-a:8081/" },
  },
  {
    duplicateMemberIndices: [2],
    egressFingerprint: "fingerprint-b",
    member: { id: "warp-1", index: 1, url: "http://warp-b:8082/" },
  },
];

function prior(
  sourceTier: PriorAcquisitionAttempt["sourceTier"],
  strategy?: PriorAcquisitionAttempt["strategy"],
  egressFingerprint?: string,
): PriorAcquisitionAttempt {
  return { sourceTier, strategy, egressFingerprint, status: "failed" };
}

describe("YouTube acquisition planning", () => {
  it("gives the operator override highest priority", () => {
    expect(
      nextAcquisitionAttempt({
        cancelled: false,
        cobaltEnabled: true,
        localRelayEnabled: true,
        operatorProxyUrl: "http://operator:9000/",
        potProviderConfigured: false,
        previous: [],
        production: true,
        warpMembers,
      }),
    ).toMatchObject({ sourceTier: "operator_proxy", strategy: "standard" });
  });

  it("never plans direct egress in production", () => {
    expect(
      nextAcquisitionAttempt({
        cancelled: false,
        cobaltEnabled: false,
        localRelayEnabled: false,
        potProviderConfigured: false,
        previous: [],
        production: true,
        warpMembers: [],
      }),
    ).toBeNull();
  });

  it("plans direct client strategies in development", () => {
    expect(
      nextAcquisitionAttempt({
        cancelled: false,
        cobaltEnabled: false,
        localRelayEnabled: false,
        potProviderConfigured: false,
        previous: [],
        production: false,
        warpMembers: [],
      }),
    ).toMatchObject({ sourceTier: "direct", strategy: "standard" });
  });

  it("does not repeat an identical egress and strategy pair", () => {
    expect(
      nextAcquisitionAttempt({
        cancelled: false,
        cobaltEnabled: false,
        localRelayEnabled: false,
        potProviderConfigured: false,
        previous: [prior("warp", "standard", "fingerprint-a")],
        production: true,
        warpMembers,
      }),
    ).toMatchObject({
      sourceTier: "warp",
      strategy: "web-safari",
      egressFingerprint: "fingerprint-a",
    });
  });

  it("tries Cobalt and then the local relay after cloud exhaustion", () => {
    const strategies = ["standard", "web-safari", "web-embedded", "android-vr"] as const;
    const exhaustedWarp = warpMembers.flatMap((member) =>
      strategies.map((strategy) => prior("warp", strategy, member.egressFingerprint)),
    );
    const cobalt = nextAcquisitionAttempt({
      cancelled: false,
      cobaltEnabled: true,
      localRelayEnabled: true,
      potProviderConfigured: false,
      previous: exhaustedWarp,
      production: true,
      warpMembers,
    });
    expect(cobalt).toMatchObject({ sourceTier: "cobalt" });
    expect(
      nextAcquisitionAttempt({
        cancelled: false,
        cobaltEnabled: true,
        localRelayEnabled: true,
        potProviderConfigured: false,
        previous: [...exhaustedWarp, prior("cobalt")],
        production: true,
        warpMembers,
      }),
    ).toMatchObject({ sourceTier: "local_relay" });
  });

  it.each(["video_private", "video_age_restricted", "video_unavailable", "cancelled"])(
    "short-circuits terminal classification %s",
    (terminalCode) => {
      expect(
        nextAcquisitionAttempt({
          cancelled: terminalCode === "cancelled",
          cobaltEnabled: true,
          localRelayEnabled: true,
          potProviderConfigured: false,
          previous: [],
          production: true,
          terminalCode,
          warpMembers,
        }),
      ).toBeNull();
    },
  );
});
