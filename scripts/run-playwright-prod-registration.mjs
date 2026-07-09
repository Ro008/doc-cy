#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

const playwrightCli = path.join(process.cwd(), "node_modules", "playwright", "cli.js");
const args = [
  "test",
  "tests/prod/prod_registration_smoke.spec.ts",
  "--project=Desktop Large (Chromium)",
  "--reporter=line",
];

const env = {
  ...process.env,
  PLAYWRIGHT_ENV_FILE: ".env.production.local",
  PLAYWRIGHT_LIVE_REGISTRATION: "1",
  PLAYWRIGHT_BASE_URL: "https://www.mydoccy.com",
};

const result = spawnSync(process.execPath, [playwrightCli, ...args], {
  stdio: "inherit",
  env,
});

process.exit(result.status ?? 1);
