// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load Next.js local env for Playwright runs (so auth tests can use TEST_USER_EMAIL/PASSWORD)
dotenv.config({ path: ".env.local" });

const localUrl = "http://localhost:3000";
// Default to local dev. For staging/prod runs, set `PLAYWRIGHT_BASE_URL`.
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? localUrl;
const safeNoBooking = process.env.PLAYWRIGHT_SAFE_NO_BOOKING === "1";

const shouldRunWebServer = baseUrl === localUrl;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: "html",
  grepInvert: safeNoBooking ? /@booking-creates/ : undefined,
  use: {
    baseURL: baseUrl,
    trace: "on-first-retry",
    // Domain/SSL might not be fully propagated yet after switching providers.
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "Desktop Large (Chromium)",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "Tablet (iPad)",
      use: { ...devices["iPad Mini"] },
    },
    {
      name: "Mobile Chrome (Pixel 5)",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari (iPhone 12)",
      use: { ...devices["iPhone 12"] },
    },
  ],
  webServer: shouldRunWebServer
    ? {
        command: "npm run dev",
        url: localUrl,
        reuseExistingServer: !process.env.CI,
      }
    : undefined,
});
