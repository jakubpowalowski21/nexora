import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";
loadEnvConfig(process.cwd(), true);
const server = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 100000,
  expect: { timeout: 18000 },
  workers: 1,
  reporter: "list",
  use: { baseURL: server, trace: "off" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL,
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname localhost --port 3000",
    url: server,
    reuseExistingServer: !process.env.CI,
    timeout: 90000,
  },
});
