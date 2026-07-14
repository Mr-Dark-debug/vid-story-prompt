import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    env: {
      PUBLIC_APP_URL: "http://127.0.0.1:4173",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
      VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    },
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
