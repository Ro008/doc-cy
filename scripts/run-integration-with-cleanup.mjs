#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";

function run(command, args, extraEnv = {}) {
  return new Promise((resolve) => {
    const commandBin = process.platform === "win32" && command === "npx" ? "npx.cmd" : command;
    const child = spawn(commandBin, args, {
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        ...extraEnv,
      },
    });
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

async function main() {
  const playwrightArgs = process.argv.slice(2);
  if (playwrightArgs.length === 0) {
    console.error("Usage: node scripts/run-integration-with-cleanup.mjs <playwright args...>");
    process.exit(1);
  }

  const envFile = process.env.PLAYWRIGHT_ENV_FILE?.trim() || ".env.testing.local";
  const playwrightCli = path.join(process.cwd(), "node_modules", "playwright", "cli.js");
  const testExitCode = await run(process.execPath, [playwrightCli, "test", ...playwrightArgs], {
    PLAYWRIGHT_ENV_FILE: envFile,
    INTEGRATION_SAFE_ENV: process.env.INTEGRATION_SAFE_ENV || "1",
  });

  const cleanupExitCode = await run("node", ["scripts/cleanup-test-doctors.mjs"], {
    PLAYWRIGHT_ENV_FILE: envFile,
  });

  if (cleanupExitCode !== 0) {
    console.error("[run-integration-with-cleanup] cleanup failed.");
  }

  process.exit(testExitCode !== 0 ? testExitCode : cleanupExitCode);
}

main().catch((error) => {
  console.error("[run-integration-with-cleanup] failed:", error);
  process.exit(1);
});
