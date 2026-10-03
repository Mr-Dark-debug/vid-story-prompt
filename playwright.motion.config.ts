import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "motion-studio.spec.ts",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4192", trace: "retain-on-failure" },
  webServer: {
    command: "npx vite --config e2e/motion-studio.vite.config.ts",
    url: "http://127.0.0.1:4192",
    reuseExistingServer: false,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
