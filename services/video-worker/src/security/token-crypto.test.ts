import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./token-crypto.js";

describe("worker token encryption", () => {
  const key = "a-worker-encryption-key-that-is-at-least-thirty-two-characters";

  it("round-trips authenticated token envelopes", () => {
    const encrypted = encryptSecret("worker-refresh-token", key);
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain("worker-refresh-token");
    expect(decryptSecret(encrypted, key)).toBe("worker-refresh-token");
  });

  it("rejects a modified authentication tag", () => {
    const encrypted = encryptSecret("worker-refresh-token", key);
    const parts = encrypted.split(".");
    parts[2] = `${parts[2]}x`;
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
  });
});
