// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load Next.js local env for Playwright runs (so auth tests can use TEST_USER_EMAIL/PASSWORD)
dotenv.config({ path: ".env.local" });

const localUrl = "http://localhost:3000";
// Default to local dev. For staging/prod runs, set `PLAYWRIGHT_BASE_URL`.
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? localUrl;
const safeNoBooking = process.env.PLAYWRIGHT_SAFE_NO_BOOKING === "1";

/** CI often uses 127.0.0.1:3000; dev uses localhost:3000 — both should start Next when requested. */
function isLocalDevBaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:") return false;
    const port = u.port || "80";
    if (port !== "3000") return false;
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
