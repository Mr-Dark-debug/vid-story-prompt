import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://worker-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "worker-test-service-role-key-long-enough";
});

import { parseCloudflareTrace, probeProxyHealth } from "./proxy-health.js";

describe("proxy health", () => {
  it("parses the Cloudflare trace without logging it", () => {
    expect(parseCloudflareTrace("fl=1\nip=203.0.113.7\nwarp=on\n")).toEqual({
      egressIp: "203.0.113.7",
      warpEnabled: true,
    });
  });

  it("reports healthy WARP only after trace and yt-dlp succeed", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "ip=203.0.113.7\nwarp=on\n" })
      .mockResolvedValueOnce({ stdout: "format list" });
    const health = await probeProxyHealth(
      { tier: "warp", url: "http://warp.internal:8080/" },
      { includeYtdlp: true, run },
    );
    expect(health).toMatchObject({
      egressIp: "203.0.113.7",
      proxyReachable: true,
      status: "healthy",
      warpEnabled: true,
      ytdlpReachable: true,
    });
    expect(run.mock.calls[1]?.[1]).toEqual(
      expect.arrayContaining(["--proxy", "http://warp.internal:8080/"]),
    );
  });

  it("blocks a configured WARP tier when trace says WARP is off", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "ip=203.0.113.8\nwarp=off\n" });
    await expect(
      probeProxyHealth(
        { tier: "render_warp", url: "http://warp.internal:8080/" },
        { includeYtdlp: false, run },
      ),
    ).resolves.toMatchObject({ errorCode: "warp_not_enabled", status: "blocked" });
  });

  it("does not silently turn an unreachable proxy into direct egress", async () => {
    const run = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));
    await expect(
      probeProxyHealth(
        { tier: "operator", url: "http://user:secret@proxy.internal:9000/" },
        { includeYtdlp: true, run },
      ),
    ).resolves.toMatchObject({
      egressIp: null,
      errorCode: "proxy_unreachable",
      proxyReachable: false,
      status: "blocked",
    });
  });

  it("marks successful direct egress as degraded", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "ip=198.51.100.4\nwarp=off\n" })
      .mockResolvedValueOnce({ stdout: "format list" });
    await expect(
      probeProxyHealth({ tier: "direct" }, { includeYtdlp: true, run }),
    ).resolves.toMatchObject({ status: "degraded", ytdlpReachable: true });
  });
});
