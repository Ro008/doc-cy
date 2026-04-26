// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import { TRAFFIC_LOG_SUPPRESS_HEADER } from "./lib/traffic-log";

// Load env file for Playwright runs (defaults to .env.local).
const envFilePath = process.env.PLAYWRIGHT_ENV_FILE?.trim() || ".env.local";
dotenv.config({ path: envFilePath });

const localUrl = "http://localhost:3000";
// Default to local dev. For staging/prod runs, set `PLAYWRIGHT_BASE_URL`.
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? localUrl;
const safeNoBooking = process.env.PLAYWRIGHT_SAFE_NO_BOOKING === "1";
const normalizedEnvFilePath = envFilePath.toLowerCase().replace(/\\/g, "/");

/** When set (same value as server DOC_CY_SUPPRESS_TRAFFIC_LOG_SECRET), E2E requests skip traffic logging. */
const trafficLogSuppressSecret = process.env.DOC_CY_SUPPRESS_TRAFFIC_LOG_SECRET?.trim();

/** CI often uses 127.0.0.1:3000; dev uses localhost:3000; integration uses :3100 via `scripts/dev-with-env.mjs`. */
function isLocalDevBaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:") return false;
    const port = u.port || "80";
    if (!["3000", "3100"].includes(port)) return false;
    return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

const shouldRunWebServer = isLocalDevBaseUrl(baseUrl);
const webServerCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND?.trim() || "npm run dev";

function requireEnvForLocalWebServer(name: string): void {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `[Playwright config] Missing required env var "${name}" while using local webServer (${baseUrl}). ` +
        "Set it in workflow/job env before running tests."
    );
  }
}

function isProductionSiteUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return host === "mydoccy.com" || host === "www.mydoccy.com";
  } catch {
    return false;
  }
}

if (isProductionSiteUrl(baseUrl) && normalizedEnvFilePath.endsWith(".env.testing.local")) {
  throw new Error(
    `[Playwright config] Refusing to run production URL "${baseUrl}" with "${envFilePath}". ` +
      `Use ".env.local" for tests/prod/* and reserve ".env.testing.local" for integration/testing.`
  );
}

if (process.env.CI && shouldRunWebServer) {
  requireEnvForLocalWebServer("NEXT_PUBLIC_SUPABASE_URL");
  requireEnvForLocalWebServer("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

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
    ...(trafficLogSuppressSecret
      ? {
          extraHTTPHeaders: {
            [TRAFFIC_LOG_SUPPRESS_HEADER]: trafficLogSuppressSecret,
          },
        }
      : {}),
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
        command: webServerCommand,
        url: baseUrl,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      }
    : undefined,
});
