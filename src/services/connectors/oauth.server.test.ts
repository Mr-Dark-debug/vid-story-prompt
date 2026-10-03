import { afterEach, describe, expect, it } from "vitest";
import {
  createSignedOAuthState,
  getConnectorOAuthConfig,
  verifyConnectorOAuthState,
} from "./oauth.server";

const touched = ["CONNECTOR_TOKEN_ENCRYPTION_KEY", "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"];
const original = Object.fromEntries(touched.map((name) => [name, process.env[name]]));
afterEach(() => {
  for (const name of touched) {
    // Assigning undefined to process.env stores the string "undefined", so delete instead.
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
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
