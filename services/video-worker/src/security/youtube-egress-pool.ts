import { createHmac } from "node:crypto";
import { TaskFailure } from "../domain/types.js";

export type ProxyPoolMember = {
  id: string;
  index: number;
  url: string;
};

export type ProxyMemberProbe = {
  member: ProxyPoolMember;
  reachable: boolean;
  warpEnabled: boolean | null;
  egressIp: string | null;
};

export type UniquePoolMember = {
  member: ProxyPoolMember;
  egressFingerprint: string;
  duplicateMemberIndices: number[];
};

const allowedProtocols = new Set(["http:", "https:", "socks5:", "socks5h:"]);

function normalizePoolUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TaskFailure("proxy_configuration_error", "A WARP pool URL is invalid.", false);
  }
  if (!allowedProtocols.has(parsed.protocol) || !parsed.hostname) {
    throw new TaskFailure(
      "proxy_configuration_error",
      "A WARP pool URL uses an unsupported proxy protocol.",
      false,
    );
  }
  return parsed.toString();
}

export function parseProxyPool(value?: string): ProxyPoolMember[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((url, index) => ({ id: `warp-${index}`, index, url: normalizePoolUrl(url) }));
}

export function fingerprintEgress(address: string, key: string) {
  if (!address || key.length < 16) {
    throw new TaskFailure(
      "proxy_configuration_error",
      "The egress fingerprint configuration is invalid.",
      false,
    );
  }
  return createHmac("sha256", key).update(address).digest("base64url");
}

export function deduplicateHealthyEgress(
  probes: ProxyMemberProbe[],
  fingerprintKey: string,
): UniquePoolMember[] {
  const unique = new Map<string, UniquePoolMember>();
  for (const probe of probes) {
    if (!probe.reachable || !probe.warpEnabled || !probe.egressIp) continue;
    const egressFingerprint = fingerprintEgress(probe.egressIp, fingerprintKey);
    const existing = unique.get(egressFingerprint);
    if (existing) {
      existing.duplicateMemberIndices.push(probe.member.index);
      continue;
    }
    unique.set(egressFingerprint, {
      member: probe.member,
      egressFingerprint,
      duplicateMemberIndices: [],
    });
  }
  return [...unique.values()].sort((left, right) => left.member.index - right.member.index);
}

export function sanitizePoolHealth(probes: ProxyMemberProbe[], fingerprintKey: string) {
  return {
    configuredMembers: probes.length,
    healthyMembers: probes.filter((probe) => probe.reachable && probe.warpEnabled).length,
    uniqueEgressMembers: deduplicateHealthyEgress(probes, fingerprintKey).length,
  };
}
