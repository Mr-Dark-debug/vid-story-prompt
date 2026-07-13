import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  safeReturnPath,
  secureTextEqual,
} from "./token-crypto.server";

describe("YouTube token security", () => {
  const key = "a-development-encryption-key-that-is-long-enough";

  it("round-trips a versioned authenticated envelope", () => {
    const encrypted = encryptSecret("refresh-token", key);
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain("refresh-token");
    expect(decryptSecret(encrypted, key)).toBe("refresh-token");
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptSecret("refresh-token", key);
    expect(() => decryptSecret(`${encrypted}x`, key)).toThrow();
  });

  it("allows only same-origin application paths", () => {
    expect(safeReturnPath("/app/youtube-clipper/new")).toBe("/app/youtube-clipper/new");
    expect(safeReturnPath("//evil.example")).toBe("/app/settings/integrations");
    expect(safeReturnPath("https://evil.example")).toBe("/app/settings/integrations");
    expect(safeReturnPath("/\\evil.example")).toBe("/app/settings/integrations");
  });

  it("compares callback secrets without a prefix match", () => {
    expect(secureTextEqual("secret", "secret")).toBe(true);
    expect(secureTextEqual("secret", "secret2")).toBe(false);
  });
});
