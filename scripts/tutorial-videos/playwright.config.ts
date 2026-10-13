// Playwright config for the tutorial videos (not part of the e2e suites).
//
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 \
//   TEST_DOCTOR_EMAIL=... TEST_DOCTOR_PASSWORD=... \
//   npx playwright test -c scripts/tutorial-videos/playwright.config.ts
//
// Each spec records two cuts: "tutorial" (16:9, desktop) and "reel" (9:16, phone, upscaled to
// 1080x1920 by compose.mjs: Playwright cannot record a video larger than the viewport).

import path from "node:path";

import { defineConfig } from "@playwright/test";

const outDir = process.env.TUTORIAL_VIDEOS_OUT ?? path.resolve("tutorial-videos-out");

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
      name: "tutorial",
      use: {
        viewport: { width: 1280, height: 720 },
        video: { mode: "on", size: { width: 1280, height: 720 } },
      },
    },
    {
      name: "reel",
      use: {
        viewport: { width: 540, height: 960 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
        video: { mode: "on", size: { width: 540, height: 960 } },
      },
    },
  ],
});
