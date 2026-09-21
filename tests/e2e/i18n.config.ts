import { defineConfig, devices } from "@playwright/test";

// This suite mocks the API and needs no Go binary, credentials or MCP servers.
export default defineConfig({
  testDir: "./features/i18n",
  fullyParallel: true,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    channel: process.env.PLAYWRIGHT_CHANNEL,
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.SKIP_WEB_SERVER
    ? undefined
    : {
        command: "npm --prefix ../../ui run dev -- --host 127.0.0.1 --port 3000",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
      },
});