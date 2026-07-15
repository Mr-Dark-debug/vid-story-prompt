import { afterEach, describe, expect, it } from "vitest";
import { createSignedOAuthState, verifyConnectorOAuthState } from "./oauth.server";

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
});
