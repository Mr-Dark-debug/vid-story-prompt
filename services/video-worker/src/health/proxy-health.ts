import { execa } from "execa";
import { env } from "../config/env.js";
import { proxyEnvironment, type YouTubeProxySelection } from "../security/youtube-proxy.js";
import {
  deduplicateHealthyEgress,
  type ProxyMemberProbe,
  type ProxyPoolMember,
  type UniquePoolMember,
} from "../security/youtube-egress-pool.js";

export type ProxyHealthStatus = "healthy" | "degraded" | "blocked" | "unknown";

export type AcquisitionTierState =
  | "ready"
  | "degraded"
  | "blocked"
  | "standby"
  | "unconfigured"
  | "unknown";

export type AcquisitionTierDiagnostic = {
  configured: boolean;
  reasonCode: string;
  state: AcquisitionTierState;
};

export type AcquisitionTierDiagnostics = {
  cobalt: AcquisitionTierDiagnostic;
  operatorProxy: AcquisitionTierDiagnostic;
  protectedPool: AcquisitionTierDiagnostic & {
    configuredMembers: number;
    healthyMembers: number;
    uniqueMembers: number;
  };
};

export type ProxyHealthSnapshot = {
  checkedAt: string | null;
  egressIp: string | null;
  errorCode: string | null;
  proxyReachable: boolean | null;
  status: ProxyHealthStatus;
  tier: YouTubeProxySelection["tier"];
  warpEnabled: boolean | null;
  ytdlpReachable: boolean | null;
  configuredMembers?: number;
  healthyMembers?: number;
  uniqueEgressMembers?: number;
  uniqueMembers?: UniquePoolMember[];
};

type CommandResult = { stdout?: unknown };
type CommandRunner = (
  file: string,
  args: string[],
  options: Record<string, unknown>,
) => Promise<CommandResult>;

export async function probeCobaltHealth(
  apiUrl: string | undefined,
  apiKey: string | undefined,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<AcquisitionTierDiagnostic> {
  if (!apiUrl || !apiKey) {
    return { configured: false, reasonCode: "cobalt_unconfigured", state: "unconfigured" };
  }
  try {
    const response = await (options.fetcher ?? fetch)(new URL("/", apiUrl), {
      method: "POST",
      headers: {
        authorization: `Api-Key ${apiKey}`,
        "content-type": "application/json",
        "user-agent": "Vidrial-Video-Worker/1",
      },
      body: JSON.stringify({ url: "https://example.invalid/vidrial-cobalt-health" }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 5_000),
    });
    const text = await response.text();
    if (text.length > 4_096) throw new Error("cobalt_probe_oversized");
    const payload = JSON.parse(text) as { error?: { code?: unknown }; status?: unknown };
    const providerCode = typeof payload.error?.code === "string" ? payload.error.code : "";
    if (providerCode.startsWith("error.api.auth.key.")) {
      return { configured: true, reasonCode: "cobalt_auth_rejected", state: "blocked" };
    }
    if (response.status >= 500 || typeof payload.status !== "string") {
      throw new Error("cobalt_probe_failed");
    }
    return { configured: true, reasonCode: "cobalt_ready", state: "ready" };
  } catch {
    return { configured: true, reasonCode: "cobalt_unreachable", state: "blocked" };
  }
}

export function acquisitionTierDiagnostics(input: {
  cobalt: AcquisitionTierDiagnostic;
  operatorProxyConfigured: boolean;
  protectedPoolConfiguredMembers: number;
  proxyHealth: ProxyHealthSnapshot;
}): AcquisitionTierDiagnostics {
  const operatorActive = input.proxyHealth.tier === "operator";
  const protectedActive =
    input.proxyHealth.tier === "warp" || input.proxyHealth.tier === "render_warp";
  const operatorProxy: AcquisitionTierDiagnostic = !input.operatorProxyConfigured
    ? { configured: false, reasonCode: "operator_proxy_unconfigured", state: "unconfigured" }
    : operatorActive
      ? {
          configured: true,
          reasonCode:
            input.proxyHealth.status === "healthy"
              ? "operator_proxy_ready"
              : input.proxyHealth.status === "blocked"
                ? "operator_proxy_blocked"
                : "operator_proxy_unverified",
          state:
            input.proxyHealth.status === "healthy"
              ? "ready"
              : input.proxyHealth.status === "blocked"
                ? "blocked"
                : "unknown",
        }
      : { configured: true, reasonCode: "operator_proxy_standby", state: "standby" };
  const configuredMembers = input.protectedPoolConfiguredMembers;
  const healthyMembers = input.proxyHealth.healthyMembers ?? 0;
  const uniqueMembers = input.proxyHealth.uniqueEgressMembers ?? 0;
  const protectedPool: AcquisitionTierDiagnostics["protectedPool"] =
    configuredMembers <= 0
      ? {
          configured: false,
          configuredMembers: 0,
          healthyMembers: 0,
          uniqueMembers: 0,
          reasonCode: "protected_pool_unconfigured",
          state: "unconfigured",
        }
      : protectedActive
        ? {
            configured: true,
            configuredMembers,
            healthyMembers,
            uniqueMembers,
            reasonCode:
              input.proxyHealth.status === "healthy"
                ? "protected_pool_ready"
                : input.proxyHealth.status === "degraded"
                  ? "protected_pool_degraded"
                  : input.proxyHealth.status === "blocked"
                    ? "protected_pool_exhausted"
                    : "protected_pool_unverified",
            state:
              input.proxyHealth.status === "healthy"
                ? "ready"
                : input.proxyHealth.status === "degraded"
                  ? "degraded"
                  : input.proxyHealth.status === "blocked"
                    ? "blocked"
                    : "unknown",
          }
        : {
            configured: true,
            configuredMembers,
            healthyMembers: 0,
            uniqueMembers: 0,
            reasonCode: "protected_pool_standby",
            state: "standby",
          };
  return { cobalt: input.cobalt, operatorProxy, protectedPool };
}

export const unknownProxyHealth = (tier: YouTubeProxySelection["tier"]): ProxyHealthSnapshot => ({
  checkedAt: null,
  egressIp: null,
  errorCode: null,
  proxyReachable: null,
  status: "unknown",
  tier,
  warpEnabled: null,
  ytdlpReachable: null,
});

export function parseCloudflareTrace(input: string) {
  const fields = new Map(
    input
      .split(/\r?\n/)
      .map((line) => line.split("=", 2))
      .filter((parts): parts is [string, string] => parts.length === 2),
  );
  const warp = fields.get("warp") ?? "unknown";
  return {
    egressIp: fields.get("ip") ?? null,
    warpEnabled: warp === "on" || warp === "plus",
  };
}

export async function probeProxyHealth(
  selection: YouTubeProxySelection,
  options: {
    includeYtdlp?: boolean;
    previous?: ProxyHealthSnapshot;
    run?: CommandRunner;
    timeoutMs?: number;
    ytdlpPath?: string;
  } = {},
): Promise<ProxyHealthSnapshot> {
  const run = options.run ?? (execa as unknown as CommandRunner);
  const timeoutMs = options.timeoutMs ?? env.YTDLP_PROXY_PROBE_TIMEOUT_MS;
  const checkedAt = new Date().toISOString();
  const proxyArgs = selection.url ? ["-x", selection.url] : [];
  let egressIp: string | null = null;
  let warpEnabled: boolean | null = null;

  try {
    const trace = await run(
      "curl",
      [
        "-fsS",
        "--max-time",
        String(Math.max(1, Math.ceil(timeoutMs / 1_000))),
        ...proxyArgs,
        "https://cloudflare.com/cdn-cgi/trace/",
      ],
      { env: proxyEnvironment(selection), timeout: timeoutMs },
    );
    const parsed = parseCloudflareTrace(String(trace.stdout ?? ""));
    egressIp = parsed.egressIp;
    warpEnabled = parsed.warpEnabled;
  } catch {
    return {
      checkedAt,
      egressIp: null,
      errorCode: "proxy_unreachable",
      proxyReachable: false,
      status: "blocked",
      tier: selection.tier,
      warpEnabled: null,
      ytdlpReachable: false,
    };
  }

  let ytdlpReachable = options.previous?.ytdlpReachable ?? null;
  if (options.includeYtdlp) {
    const args = [
      "-F",
      "--no-warnings",
      "--no-playlist",
      "--no-cookies",
      "--ignore-config",
      "--force-ipv4",
    ];
    if (selection.url) args.push("--proxy", selection.url);
    args.push("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    try {
      await run(options.ytdlpPath ?? env.YTDLP_PATH, args, {
        env: proxyEnvironment(selection),
        timeout: Math.max(timeoutMs, 30_000),
      });
      ytdlpReachable = true;
    } catch {
      ytdlpReachable = false;
    }
  }

  const warpRequired = selection.tier === "warp" || selection.tier === "render_warp";
  const errorCode =
    warpRequired && !warpEnabled
      ? "warp_not_enabled"
      : ytdlpReachable === false
        ? "youtube_probe_failed"
        : null;
  const status: ProxyHealthStatus = errorCode
    ? "blocked"
    : selection.tier === "direct" || ytdlpReachable === null
      ? "degraded"
      : "healthy";
  return {
    checkedAt,
    egressIp,
    errorCode,
    proxyReachable: true,
    status,
    tier: selection.tier,
    warpEnabled,
    ytdlpReachable,
  };
}

export async function probeProxyPoolHealth(
  members: ProxyPoolMember[],
  options: {
    fingerprintKey: string;
    includeYtdlp?: boolean;
    minimumUniqueMembers?: number;
    run?: CommandRunner;
    timeoutMs?: number;
    ytdlpPath?: string;
  },
): Promise<ProxyHealthSnapshot> {
  const snapshots = await Promise.all(
    members.map((member) =>
      probeProxyHealth(
        { tier: "warp", url: member.url },
        {
          includeYtdlp: options.includeYtdlp,
          run: options.run,
          timeoutMs: options.timeoutMs,
          ytdlpPath: options.ytdlpPath,
        },
      ),
    ),
  );
  const probes: ProxyMemberProbe[] = snapshots.map((snapshot, index) => ({
    member: members[index],
    reachable: snapshot.proxyReachable === true && snapshot.ytdlpReachable !== false,
    warpEnabled: snapshot.warpEnabled,
    egressIp: snapshot.egressIp,
  }));
  const uniqueMembers = deduplicateHealthyEgress(probes, options.fingerprintKey);
  const healthyMembers = probes.filter((probe) => probe.reachable && probe.warpEnabled).length;
  const minimumUniqueMembers = Math.max(1, options.minimumUniqueMembers ?? 1);
  const status: ProxyHealthStatus =
    uniqueMembers.length >= minimumUniqueMembers
      ? "healthy"
      : healthyMembers > 0
        ? "degraded"
        : "blocked";
  return {
    checkedAt: new Date().toISOString(),
    egressIp: null,
    errorCode: status === "healthy" ? null : "insufficient_unique_egress",
    proxyReachable: healthyMembers > 0,
    status,
    tier: "warp",
    warpEnabled: healthyMembers > 0,
    ytdlpReachable: snapshots.some((snapshot) => snapshot.ytdlpReachable === true),
    configuredMembers: members.length,
    healthyMembers,
    uniqueEgressMembers: uniqueMembers.length,
    uniqueMembers,
  };
}
