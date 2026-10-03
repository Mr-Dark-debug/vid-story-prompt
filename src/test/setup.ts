import "@testing-library/jest-dom/vitest";

/**
 * Safe, obviously fake configuration so `npm test` passes on a clean checkout with no `.env`.
 * `??=` keeps any value the developer or CI already exported (for example the opt-in Supabase
 * integration run), so these never override real configuration.
 */
const testEnvDefaults: Record<string, string> = {
  VITE_SUPABASE_URL: "http://127.0.0.1:54321",
  VITE_SUPABASE_ANON_KEY: "test-anon-key-not-a-real-credential-0000",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "test-anon-key-not-a-real-credential-0000",
  PUBLIC_APP_URL: "http://localhost:3000",
  CONNECTOR_TOKEN_ENCRYPTION_KEY: "test-connector-encryption-key-material-123456",
  GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY: "test-google-oauth-encryption-key-material-1234",
  AI_CREDENTIAL_ENCRYPTION_KEY: "test-ai-credential-encryption-key-material-1234",
};

for (const [name, value] of Object.entries(testEnvDefaults)) {
  process.env[name] ??= value;
}
