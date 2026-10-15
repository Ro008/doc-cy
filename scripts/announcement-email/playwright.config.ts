// Playwright config for the animations in the "what's new" email (not part of the e2e suites).
//
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
//   ANNOUNCEMENT_OUT=<dir> npx playwright test -c scripts/announcement-email/playwright.config.ts
//
// Same demo stack and helpers as scripts/tutorial-videos; see README.md here.

import path from "node:path";

import { defineConfig } from "@playwright/test";

const outDir = process.env.ANNOUNCEMENT_OUT ?? path.resolve("announcement-out");

export default defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.ts/,
  outputDir: path.join(outDir, "raw"),
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "gif",
      use: {
        viewport: { width: 1280, height: 720 },
        video: { mode: "on", size: { width: 1280, height: 720 } },
      },
    },
  ],
});
