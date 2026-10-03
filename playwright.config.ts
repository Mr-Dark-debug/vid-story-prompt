import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4191",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npx vite dev --host 127.0.0.1 --port 4191 --strictPort",
      env: {
        PUBLIC_APP_URL: "http://127.0.0.1:4191",
        TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
        VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      },
      url: "http://127.0.0.1:4191",
      reuseExistingServer: false,
    },
    {
      command: "npx vite --config e2e/clip-studio.vite.config.ts",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npx vite --config e2e/motion-studio.vite.config.ts",
      url: "http://127.0.0.1:4192",
      reuseExistingServer: false,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
