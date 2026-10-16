import { spawnSync } from "node:child_process";
import fs from "node:fs";

import { migrationsEnabledForProject } from "./lib/supabase-remote-config.mjs";

const PROD_REF = "oiwlztcduxojadbcxkil";
const TESTING_REF = "fwinchqdgrkpxuuttech";

function runSupabase(args, { exitOnError = true } = {}) {
  const result = spawnSync("npx", ["supabase", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  const status = result.status ?? 1;
  if (status !== 0 && exitOnError) {
    process.exit(status);
  }
  return status;
}

function linkTesting() {
  runSupabase(["link", "--project-ref", TESTING_REF]);
}

function linkProd() {
  runSupabase(["link", "--project-ref", PROD_REF]);
}

/**
 * supabase/config.toml turns migrations off for the local CI stack. A push to a real project
 * only applies them if that project has its own [remotes.*] block turning them on; otherwise
 * the CLI says "Skipping migrations", applies nothing and exits 0. Refuse that quietly-green case.
 */
function requireMigrationsEnabled(ref, label) {
  const toml = fs.readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");
  if (migrationsEnabledForProject(toml, ref)) return;
  console.error(
    [
      "",
      `Refusing to push: supabase/config.toml would skip migrations for ${label} (${ref}).`,
      "Add a [remotes.*] block for it with [remotes.*.db.migrations] enabled = true (see the others there).",
      "",
    ].join("\n")
  );
  process.exit(1);
}

function requireProdConfirmation() {
  if (process.env.DOC_CY_CONFIRM_PROD === "YES") return;
  console.error(
    [
      "",
      "Refusing to push to production without explicit confirmation.",
      "Run again with: DOC_CY_CONFIRM_PROD=YES npm run db:prod:push",
      "",
    ].join("\n")
  );
  process.exit(1);
}

function usage() {
  console.log(
    [
      "Usage: node scripts/supabase-safe.mjs <command>",
      "",
      "Commands:",
      "  status         - Show Supabase projects and linked project",
      "  link-testing   - Link CLI to DocCy - Testing",
      "  dry-testing    - Link to testing, list the migrations a push would apply (writes nothing)",
      "  push-testing   - Link to testing, then run db push",
      "  link-prod      - Link CLI to DocCy production",
      "  dry-prod       - Link to prod, list the migrations a push would apply (writes nothing),",
      "                  then restore link to testing",
      "  push-prod      - Link to prod, run db push, then restore link to testing",
      "                  (requires DOC_CY_CONFIRM_PROD=YES)",
      "",
    ].join("\n")
  );
}

const command = process.argv[2];

switch (command) {
  case "status":
    runSupabase(["projects", "list"]);
    break;
  case "link-testing":
    linkTesting();
    runSupabase(["projects", "list"]);
    break;
  case "dry-testing":
    requireMigrationsEnabled(TESTING_REF, "DocCy - Testing");
    linkTesting();
    runSupabase(["db", "push", "--dry-run"]);
    break;
  case "push-testing":
    requireMigrationsEnabled(TESTING_REF, "DocCy - Testing");
    linkTesting();
    runSupabase(["projects", "list"]);
    runSupabase(["db", "push"]);
    break;
  case "link-prod":
    linkProd();
    runSupabase(["projects", "list"]);
    break;
  case "dry-prod": {
    // Read only: no confirmation needed. Restore the testing link even if the dry run fails.
    requireMigrationsEnabled(PROD_REF, "DocCy production");
    linkProd();
    const dryStatus = runSupabase(["db", "push", "--dry-run"], { exitOnError: false });
    linkTesting();
    if (dryStatus !== 0) process.exit(dryStatus);
    break;
  }
  case "push-prod": {
    requireProdConfirmation();
    requireMigrationsEnabled(PROD_REF, "DocCy production");
    linkProd();
    runSupabase(["projects", "list"]);
    // Keep going to restore testing link even if push fails.
    const pushStatus = runSupabase(["db", "push"], { exitOnError: false });
    console.log(
      "\nRestoring CLI link to DocCy - Testing (safe default after prod push)...\n"
    );
    linkTesting();
    runSupabase(["projects", "list"]);
    if (pushStatus !== 0) {
      process.exit(pushStatus);
    }
    break;
  }
  default:
    usage();
    process.exit(command ? 1 : 0);
}
