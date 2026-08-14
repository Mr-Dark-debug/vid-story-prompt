import { describe, expect, it } from "vitest";
import { mapWorkerProxyHealth } from "./server";

describe("source access health boundary", () => {
  it("maps worker health to browser-safe source access copy", () => {
    const result = mapWorkerProxyHealth({
      checked_at: "2026-07-18T20:00:00.000Z",
      proxy_tier: "render_warp",
      status: "healthy",
    });

    expect(result).toEqual({
      checkedAt: "2026-07-18T20:00:00.000Z",
      message: "Automatic source access is available.",
      status: "healthy",
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
    expect(JSON.stringify(result)).not.toMatch(/warp|cobalt|proxy|adapter|egress/i);
  });
});
