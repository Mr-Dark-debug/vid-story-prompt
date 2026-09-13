import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://worker-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "worker-test-service-role-key-long-enough";
});

import { TaskFailure } from "../domain/types.js";
import { acquireYouTubeSource, acquisitionBackoffMilliseconds } from "./youtube-acquisition.js";

const members = [
  {
    member: { id: "warp-0", index: 0, url: "http://warp-0.test:8080" },
    egressFingerprint: "fingerprint-0000000000000000",
    duplicateMemberIndices: [],
  },
  {
    member: { id: "warp-1", index: 1, url: "http://warp-1.test:8080" },
    egressFingerprint: "fingerprint-1111111111111111",
    duplicateMemberIndices: [],
  },
];

function setup(overrides: Record<string, unknown> = {}) {
  const recorded: Array<Record<string, unknown>> = [];
  const finished: Array<Record<string, unknown>> = [];
  return {
    recorded,
    finished,
    input: {
      cancelled: () => false,
      cobaltEnabled: true,
      downloadCobalt: vi.fn().mockResolvedValue({
        bytes: 30,
        filename: "/tmp/cobalt.mp4",
        format: "mp4",
        proxyTier: "cobalt",
        sectionApplied: false,
      }),
      downloadYtdlp: vi
        .fn()
        .mockRejectedValue(
          new TaskFailure("provider_auth_challenge", "Provider challenged the request.", true),
        ),
      finishAttempt: vi.fn(async (id, status, error) => {
        finished.push({ id, status, code: error?.code });
      }),
      potProviderConfigured: false,
      previous: [],
      production: true,
      recordAttempt: vi.fn(async (attempt, ordinal) => {
        recorded.push({ ...attempt, ordinal });
        return { id: `attempt-${ordinal}` };
      }),
      warpMembers: members,
      waitBeforeRetry: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
  };
}

describe("YouTube acquisition runner", () => {
  it("persists every bounded WARP path before falling through to Cobalt", async () => {
    const state = setup();
    const result = await acquireYouTubeSource(state.input);
    expect(result).toMatchObject({ sourceTier: "cobalt", proxyTier: "cobalt" });
    expect(state.recorded).toHaveLength(7);
    expect(state.recorded.slice(0, 3).map((item) => item.poolMemberIndex)).toEqual([0, 0, 0]);
    expect(state.recorded.slice(3, 6).map((item) => item.poolMemberIndex)).toEqual([1, 1, 1]);
    expect(state.recorded[6]).toMatchObject({ sourceTier: "cobalt", ordinal: 7 });
    expect(state.finished.filter((item) => item.status === "failed")).toHaveLength(6);
  });

  it("uses the operator override before the WARP pool", async () => {
    const state = setup({
      operatorProxyUrl: "https://operator.example.test",
      downloadYtdlp: vi.fn().mockResolvedValue({
        bytes: 20,
        filename: "/tmp/operator.mp4",
        format: "mp4",
        proxyTier: "operator",
        sectionApplied: true,
      }),
    });
    const result = await acquireYouTubeSource(state.input);
    expect(result.sourceTier).toBe("operator_proxy");
    expect(state.recorded[0]).toMatchObject({ sourceTier: "operator_proxy", ordinal: 1 });
  });

  it("does not retry a path that already has a terminal attempt", async () => {
    const previous = members.flatMap((member) =>
      ["standard", "web-safari", "web-embedded"].map((strategy) => ({
        sourceTier: "warp" as const,
        strategy: strategy as "standard",
        egressFingerprint: member.egressFingerprint,
        status: "failed" as const,
      })),
    );
    const state = setup({ previous });
    const result = await acquireYouTubeSource(state.input);
    expect(result.sourceTier).toBe("cobalt");
    expect(state.recorded).toEqual([expect.objectContaining({ sourceTier: "cobalt", ordinal: 7 })]);
  });

  it("stops immediately for a terminal restriction", async () => {
    const state = setup({
      downloadYtdlp: vi
        .fn()
        .mockRejectedValue(
          new TaskFailure("video_region_restricted", "This source is region restricted.", false),
        ),
    });
    await expect(acquireYouTubeSource(state.input)).rejects.toMatchObject({
      code: "video_region_restricted",
    });
    expect(state.recorded).toHaveLength(1);
    expect(state.input.downloadCobalt).not.toHaveBeenCalled();
  });

  it("fails once without repeating cloud calls after all paths are recorded", async () => {
    const previous = [
      ...members.flatMap((member) =>
        ["standard", "web-safari", "web-embedded"].map((strategy) => ({
          sourceTier: "warp" as const,
          strategy: strategy as "standard",
          egressFingerprint: member.egressFingerprint,
          status: "failed" as const,
        })),
      ),
      { sourceTier: "cobalt" as const, status: "failed" as const },
    ];
    const state = setup({ previous });
    await expect(acquireYouTubeSource(state.input)).rejects.toMatchObject({
      // Legacy attempt rows lack error codes; absence is not evidence of an IP block.
      code: "provider_unknown_failure",
      retryable: false,
    });
    expect(state.recorded).toHaveLength(0);
  });

  it("retries a transient path once with backoff before switching clients", async () => {
    const download = vi
      .fn()
      .mockRejectedValueOnce(new TaskFailure("provider_rate_limited", "Rate limited", true))
      .mockResolvedValue({
        bytes: 1,
        filename: "/tmp/source.mp4",
        format: "mp4",
        proxyTier: "warp",
        sectionApplied: false,
      });
    const state = setup({ downloadYtdlp: download });
    await acquireYouTubeSource(state.input);
    expect(state.recorded).toHaveLength(2);
    expect(state.recorded.map((item) => item.strategy)).toEqual(["standard", "standard"]);
    expect(state.recorded.map((item) => item.ordinal)).toEqual([1, 2]);
    expect(state.input.waitBeforeRetry).toHaveBeenCalledOnce();
    expect(state.input.waitBeforeRetry.mock.calls[0][0]).toBeGreaterThanOrEqual(5_000);
  });

  it("keeps transient retry counts bounded across restarts", async () => {
    const previous = [1, 2].map(() => ({
      sourceTier: "warp" as const,
      strategy: "standard" as const,
      egressFingerprint: members[0].egressFingerprint,
      status: "failed" as const,
      errorCode: "provider_temporary_failure",
    }));
    const state = setup({
      previous,
      downloadYtdlp: vi.fn().mockResolvedValue({
        bytes: 1,
        filename: "/tmp/source.mp4",
        format: "mp4",
        proxyTier: "warp",
        sectionApplied: false,
      }),
    });
    await acquireYouTubeSource(state.input);
    expect(state.recorded[0]).toMatchObject({ strategy: "web-safari", ordinal: 3 });
    expect(state.input.waitBeforeRetry).toHaveBeenCalledOnce();
  });

  it("stops cancellation during backoff before making another request", async () => {
    let cancelled = false;
    const state = setup({
      cancelled: () => cancelled,
      waitBeforeRetry: vi.fn(async () => {
        cancelled = true;
      }),
    });
    await expect(acquireYouTubeSource(state.input)).rejects.toMatchObject({ code: "cancelled" });
    expect(state.recorded).toHaveLength(1);
  });

  it("does not infer an IP block when no production path is configured", async () => {
    const state = setup({ warpMembers: [], cobaltEnabled: false });
    await expect(acquireYouTubeSource(state.input)).rejects.toMatchObject({
      code: "provider_unknown_failure",
      retryable: false,
    });
    expect(state.input.downloadYtdlp).not.toHaveBeenCalled();
  });

  it("skips direct acquisition when forceProxy is requested in development", async () => {
    const state = setup({ production: false, forceProxy: true });
    await acquireYouTubeSource(state.input);
    expect(state.recorded.every((item) => item.sourceTier !== "direct")).toBe(true);
  });

  it("bounds exponential backoff with positive jitter", () => {
    expect(acquisitionBackoffMilliseconds(1, 0)).toBe(5_000);
    expect(acquisitionBackoffMilliseconds(100, 1)).toBe(36_000);
  });
});
