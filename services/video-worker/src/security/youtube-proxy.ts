import { TaskFailure } from "../domain/types.js";

export type YouTubeProxyTier = "direct" | "operator" | "warp" | "render_warp";

export type YouTubeProxySelection = {
  tier: YouTubeProxyTier;
  url?: string;
};

type ProxyResolutionInput = {
  forceProxy?: boolean;
  production: boolean;
  renderWarpHost?: string;
  renderWarpPort?: number;
  warpProxyUrl?: string;
  ytdlpProxyUrl?: string;
};

function normalizeProxyUrl(value: string, label: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TaskFailure("proxy_configuration_error", `${label} is not a valid proxy URL.`, false);
  }
  if (!["http:", "https:", "socks5:", "socks5h:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new TaskFailure(
      "proxy_configuration_error",
      `${label} uses an unsupported proxy protocol.`,
      false,
    );
  }
  return parsed.toString();
}

function renderProxyUrl(host: string, port: number) {
  if (!/^[A-Za-z0-9.-]+$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TaskFailure(
      "proxy_configuration_error",
      "The Render WARP service address is invalid.",
      false,
    );
  }
  return `http://${host}:${port}/`;
}

export function resolveYouTubeProxy(input: ProxyResolutionInput): YouTubeProxySelection {
  if (input.ytdlpProxyUrl) {
    return {
      tier: "operator",
      url: normalizeProxyUrl(input.ytdlpProxyUrl, "YTDLP_PROXY_URL"),
    };
  }
  if (input.warpProxyUrl) {
    return {
      tier: "warp",
      url: normalizeProxyUrl(input.warpProxyUrl, "WARP_PROXY_URL"),
    };
  }
  if (input.production && input.renderWarpHost) {
    return {
      tier: "render_warp",
      url: renderProxyUrl(input.renderWarpHost, input.renderWarpPort ?? 8080),
    };
  }
  if (input.forceProxy) {
    throw new TaskFailure(
      "proxy_configuration_error",
      "Protected egress was requested, but no worker proxy is configured.",
      false,
    );
  }
  return { tier: "direct" };
}

export function proxyEnvironment(selection: YouTubeProxySelection): Record<string, string> {
  if (!selection.url) return {};
  return {
    ALL_PROXY: selection.url,
    HTTPS_PROXY: selection.url,
    HTTP_PROXY: selection.url,
    all_proxy: selection.url,
    https_proxy: selection.url,
    http_proxy: selection.url,
  };
}

export function describeProxy(selection: YouTubeProxySelection) {
  return {
    configured: Boolean(selection.url),
    tier: selection.tier,
  };
}
