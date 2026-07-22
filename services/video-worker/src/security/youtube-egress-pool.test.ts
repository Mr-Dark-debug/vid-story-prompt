import { describe, expect, it } from "vitest";
import { TaskFailure } from "../domain/types.js";
import {
  deduplicateHealthyEgress,
  fingerprintEgress,
  parseProxyPool,
  sanitizePoolHealth,
} from "./youtube-egress-pool.js";

describe("YouTube egress pool", () => {
  it("parses trimmed proxy URLs with stable opaque member ids", () => {
    expect(parseProxyPool(" http://warp-a:8081, socks5h://warp-b:1080 ")).toEqual([
      { id: "warp-0", index: 0, url: "http://warp-a:8081/" },
      { id: "warp-1", index: 1, url: "socks5h://warp-b:1080" },
    ]);
    expect(parseProxyPool(undefined)).toEqual([]);
    expect(parseProxyPool(" , ")).toEqual([]);
  });

  it("rejects unsupported or malformed URLs without echoing credentials", () => {
    expect(() => parseProxyPool("file:///tmp/proxy")).toThrow(TaskFailure);
    try {
      parseProxyPool("http://user:super-secret@/");
    } catch (error) {
      expect(String(error)).not.toContain("super-secret");
    }
  });

  it("deduplicates healthy members by keyed egress fingerprint", () => {
    const members = parseProxyPool(
      "http://warp-a:8081,http://warp-b:8082,http://warp-c:8083,http://warp-d:8084",
    );
    const unique = deduplicateHealthyEgress(
      [
        { member: members[0], reachable: true, warpEnabled: true, egressIp: "203.0.113.10" },
        { member: members[1], reachable: true, warpEnabled: true, egressIp: "203.0.113.10" },
        { member: members[2], reachable: false, warpEnabled: null, egressIp: null },
        { member: members[3], reachable: true, warpEnabled: true, egressIp: "203.0.113.11" },
      ],
      "fingerprint-key-that-is-long-enough",
    );
    expect(unique).toHaveLength(2);
    expect(unique.map((item) => item.member.index)).toEqual([0, 3]);
    expect(unique[0].duplicateMemberIndices).toEqual([1]);
    expect(JSON.stringify(unique)).not.toContain("203.0.113");
  });

  it("creates stable keyed fingerprints without returning the address", () => {
    const first = fingerprintEgress("198.51.100.20", "fingerprint-key-that-is-long-enough");
    const second = fingerprintEgress("198.51.100.20", "fingerprint-key-that-is-long-enough");
    expect(first).toBe(second);
    expect(first).not.toContain("198.51.100.20");
    expect(fingerprintEgress("198.51.100.21", "fingerprint-key-that-is-long-enough")).not.toBe(
      first,
    );
  });

  it("sanitizes browser-facing pool health", () => {
    const members = parseProxyPool("http://user:secret@warp-a:8081,http://warp-b:8082");
    const health = sanitizePoolHealth(
      [
        { member: members[0], reachable: true, warpEnabled: true, egressIp: "203.0.113.10" },
        { member: members[1], reachable: true, warpEnabled: true, egressIp: "203.0.113.10" },
      ],
      "fingerprint-key-that-is-long-enough",
    );
    expect(health).toEqual({ configuredMembers: 2, healthyMembers: 2, uniqueEgressMembers: 1 });
    expect(JSON.stringify(health)).not.toMatch(/secret|warp-a|203\.0\.113/);
  });
});
