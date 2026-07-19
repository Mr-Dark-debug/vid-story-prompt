import { describe, expect, it } from "vitest";
import { hashRelaySecret, signRelayCapability, verifyRelayCapability } from "./relay-token.server";

const key = "relay-test-signing-key-with-more-than-32-characters";
const claims = {
  version: 1 as const,
  jobId: "2c0c70a6-99ad-4b2d-a463-997641803126",
  videoId: "dQw4w9WgXcQ",
  expectedDurationSeconds: 600,
  sourceSection: { startSeconds: 30, endSeconds: 45 },
  uploadPath:
    "2c0c70a6-99ad-4b2d-a463-997641803126/1e73908e-a3d7-4f57-8bfd-8e6ca524abb9/2c0c70a6-99ad-4b2d-a463-997641803126/relay/2ecba4c4-cbb3-443b-aee6-4c78508a30f7.mp4",
  maximumBytes: 2_147_483_648,
  expiresAt: "2030-01-01T00:00:00.000Z",
  nonce: "2ecba4c4-cbb3-443b-aee6-4c78508a30f7",
};

describe("relay capabilities", () => {
  it("round-trips signed, scoped claims", () => {
    const token = signRelayCapability(claims, key);
    expect(verifyRelayCapability(token, key, Date.parse("2029-01-01"))).toEqual(claims);
    expect(hashRelaySecret(token)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects tampering and expiry", () => {
    const token = signRelayCapability(claims, key);
    expect(() => verifyRelayCapability(`${token}x`, key)).toThrow("Invalid relay capability");
    expect(() => verifyRelayCapability(token, key, Date.parse("2031-01-01"))).toThrow(
      "Relay capability expired",
    );
  });
});
