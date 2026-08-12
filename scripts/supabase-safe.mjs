import { spawnSync } from "node:child_process";

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
      "  push-testing   - Link to testing, then run db push",
      "  link-prod      - Link CLI to DocCy production",
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
  case "push-testing":
    linkTesting();
    runSupabase(["projects", "list"]);
    runSupabase(["db", "push"]);
    break;
  case "link-prod":
    linkProd();
    runSupabase(["projects", "list"]);
    break;
  case "push-prod": {
    requireProdConfirmation();
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
