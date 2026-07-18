import { describe, expect, it } from "vitest";
import { TaskFailure } from "../domain/types.js";
import { describeProxy, proxyEnvironment, resolveYouTubeProxy } from "./youtube-proxy.js";

describe("YouTube proxy selection", () => {
  it("gives the operator override highest priority", () => {
    expect(
      resolveYouTubeProxy({
        production: true,
        ytdlpProxyUrl: "http://user:secret@operator.internal:9000",
        warpProxyUrl: "http://warp-explicit:8080",
        renderWarpHost: "warp-render",
      }),
    ).toEqual({
      tier: "operator",
      url: "http://user:secret@operator.internal:9000/",
    });
  });

  it("uses explicit WARP before the Render service address", () => {
    expect(
      resolveYouTubeProxy({
        production: true,
        warpProxyUrl: "http://warp-explicit:8080",
        renderWarpHost: "warp-render",
      }),
    ).toEqual({ tier: "warp", url: "http://warp-explicit:8080/" });
  });

  it("builds the production Render-internal WARP address", () => {
    expect(
      resolveYouTubeProxy({
        production: true,
        renderWarpHost: "vidrial-warp-proxy",
        renderWarpPort: 8080,
      }),
    ).toEqual({ tier: "render_warp", url: "http://vidrial-warp-proxy:8080/" });
  });

  it("uses direct egress in development when no proxy is configured", () => {
    expect(resolveYouTubeProxy({ production: false })).toEqual({ tier: "direct" });
  });

  it("fails closed when protected egress is forced without a proxy", () => {
    expect(() => resolveYouTubeProxy({ forceProxy: true, production: false })).toThrow(TaskFailure);
  });

  it("passes the selected proxy through uppercase and lowercase subprocess variables", () => {
    const selection = resolveYouTubeProxy({
      production: true,
      warpProxyUrl: "http://warp-explicit:8080",
    });
    expect(proxyEnvironment(selection)).toEqual({
      ALL_PROXY: "http://warp-explicit:8080/",
      HTTPS_PROXY: "http://warp-explicit:8080/",
      HTTP_PROXY: "http://warp-explicit:8080/",
      all_proxy: "http://warp-explicit:8080/",
      https_proxy: "http://warp-explicit:8080/",
      http_proxy: "http://warp-explicit:8080/",
    });
    expect(describeProxy(selection)).toEqual({ configured: true, tier: "warp" });
    expect(JSON.stringify(describeProxy(selection))).not.toContain("warp-explicit");
  });

  it("rejects unsupported proxy protocols and invalid Render hostnames", () => {
    expect(() =>
      resolveYouTubeProxy({ production: true, warpProxyUrl: "file:///tmp/proxy" }),
    ).toThrow(TaskFailure);
    expect(() =>
      resolveYouTubeProxy({ production: true, renderWarpHost: "http://warp:8080" }),
    ).toThrow(TaskFailure);
  });
});
