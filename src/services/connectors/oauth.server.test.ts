import { afterEach, describe, expect, it } from "vitest";
import {
  createSignedOAuthState,
  getConnectorOAuthConfig,
  verifyConnectorOAuthState,
} from "./oauth.server";

const original = process.env.CONNECTOR_TOKEN_ENCRYPTION_KEY;
afterEach(() => {
  process.env.CONNECTOR_TOKEN_ENCRYPTION_KEY = original;
});

describe("connector OAuth state", () => {
  it("signs state and rejects tampering", () => {
    process.env.CONNECTOR_TOKEN_ENCRYPTION_KEY = "test-connector-encryption-key-material-123456";
    const state = createSignedOAuthState("nonce-value");
    expect(verifyConnectorOAuthState(state)).toBe(true);
    expect(verifyConnectorOAuthState(`${state}tampered`)).toBe(false);
    expect(verifyConnectorOAuthState("nonce.invalid")).toBe(false);
  });

  it("keeps social publishing scopes credential-gated and provider-specific", () => {
    process.env.CONNECTOR_TOKEN_ENCRYPTION_KEY = "test-connector-encryption-key-material-123456";
    process.env.TIKTOK_CLIENT_KEY = "test-client-key";
    process.env.TIKTOK_CLIENT_SECRET = "test-client-secret";
    const config = getConnectorOAuthConfig("tiktok");
    expect(config.provider).toBe("tiktok");
    expect(config.scopes).toContain("video.publish");
    expect(config.clientIdParameter).toBe("client_key");
    expect(config.capabilities).toEqual(["video_publish"]);
  });
});
