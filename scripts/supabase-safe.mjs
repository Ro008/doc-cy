import { spawnSync } from "node:child_process";

const PROD_REF = "oiwlztcduxojadbcxkil";
const TESTING_REF = "fwinchqdgrkpxuuttech";

function runSupabase(args) {
  const result = spawnSync("npx", ["supabase", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
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
      "  push-prod      - Link to prod, then run db push (requires DOC_CY_CONFIRM_PROD=YES)",
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
  case "push-prod":
    requireProdConfirmation();
    linkProd();
    runSupabase(["projects", "list"]);
    runSupabase(["db", "push"]);
    break;
  default:
    usage();
    process.exit(command ? 1 : 0);
}
