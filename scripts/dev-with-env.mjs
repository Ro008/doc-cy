#!/usr/bin/env node
import { spawn } from "node:child_process";
import { config as loadEnv } from "dotenv";

const envFile = process.argv[2] || ".env.local";
// PORT (set by the preview harness's autoPort assignment) takes priority over
// the positional arg, so a fixed port passed here doesn't fight an assigned one.
const port = process.env.PORT || process.argv[3] || "3000";

loadEnv({ path: envFile, override: true });

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "-p", String(port)],
  {
    stdio: "inherit",
    // Windows: spawn EINVAL without a shell when invoking npx.cmd with argv-style args.
    shell: process.platform === "win32",
    env: {
      ...process.env,
    },
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
