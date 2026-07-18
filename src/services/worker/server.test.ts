import { describe, expect, it } from "vitest";
import { mapWorkerProxyHealth } from "./server";

describe("worker egress health boundary", () => {
  it("maps WARP health to a protected browser-safe status", () => {
    const result = mapWorkerProxyHealth({
      checked_at: "2026-07-18T20:00:00.000Z",
      proxy_tier: "render_warp",
      status: "healthy",
    });

    expect(result).toEqual({
      checkedAt: "2026-07-18T20:00:00.000Z",
      message: "The worker verified protected WARP egress and YouTube reachability.",
      status: "healthy",
      tier: "protected",
    });
  });

  it("does not copy worker-only proxy or egress fields", () => {
    const result = mapWorkerProxyHealth({
      checked_at: null,
      egress_ip: "203.0.113.9",
      proxy_tier: "operator",
      proxy_url: "http://user:secret@proxy.internal:8080",
      status: "healthy",
    } as never);

    expect(JSON.stringify(result)).not.toMatch(/203\.0\.113\.9|secret|proxy\.internal/i);
  });
});
