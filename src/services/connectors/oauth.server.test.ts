import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSignedOAuthState,
  getConnectorOAuthConfig,
  verifyConnectorOAuthState,
} from "./oauth.server";

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://unit.test");
  vi.stubEnv("SUPABASE_ANON_KEY", "unit-test-publishable-key-no-network");
});
afterEach(() => vi.unstubAllEnvs());

describe("connector OAuth state", () => {
  it("signs state and rejects tampering", () => {
    vi.stubEnv("CONNECTOR_TOKEN_ENCRYPTION_KEY", "test-connector-encryption-key-material-123456");
    const state = createSignedOAuthState("nonce-value");
    expect(verifyConnectorOAuthState(state)).toBe(true);
    expect(verifyConnectorOAuthState(`${state}tampered`)).toBe(false);
    expect(verifyConnectorOAuthState("nonce.invalid")).toBe(false);
  });

  it("keeps social publishing scopes credential-gated and provider-specific", () => {
    vi.stubEnv("CONNECTOR_TOKEN_ENCRYPTION_KEY", "test-connector-encryption-key-material-123456");
    vi.stubEnv("TIKTOK_CLIENT_KEY", "test-client-key");
    vi.stubEnv("TIKTOK_CLIENT_SECRET", "test-client-secret");
    const config = getConnectorOAuthConfig("tiktok");
    expect(config.provider).toBe("tiktok");
    expect(config.scopes).toContain("video.publish");
    expect(config.clientIdParameter).toBe("client_key");
    expect(config.capabilities).toEqual(["video_publish"]);
  });
});
