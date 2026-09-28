// Refreshes the CI database snapshot from DocCy - Testing (read-only: pg_dump + migration list).
//
//   node scripts/ci-db/dump-snapshot.mjs
//
// Writes, under supabase/ci/:
//   schema.sql               schema only, no rows
//   applied-migrations.txt   migration versions applied in Testing (so CI applies only the rest)
//   catalogue.sql            rows of the allowlisted catalogue tables (no personal data)
//
// Run it after applying a migration to Testing, and commit the result.
// Needs Docker running (the CLI runs pg_dump in a container) and the CLI linked to Testing.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SUPABASE_CLI, TESTING_REF, supabase } from "./cli.mjs";
import { publicTablesOutside } from "./load-lib.mjs";

// Reference data the app needs to work. Never add a table holding people, logins or bookings.
const CATALOGUE_TABLES = ["app_settings", "request_types", "specialties"];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(repoRoot, "supabase", "ci");

const linkedRef = fs.readFileSync(path.join(repoRoot, "supabase", ".temp", "project-ref"), "utf8").trim();
if (linkedRef !== TESTING_REF) {
  console.error(`The CLI is linked to ${linkedRef}, not DocCy - Testing. Run: npm run db:testing:link`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const schemaPath = path.join(outDir, "schema.sql");

console.log(`Dumping the Testing schema with ${SUPABASE_CLI}…`);
supabase(["db", "dump", "--linked", "-f", "supabase/ci/schema.sql"], { cwd: repoRoot });

const listing = JSON.parse(
  supabase(["migration", "list", "--linked", "--output-format", "json"], { cwd: repoRoot }).match(/\{[\s\S]*\}\s*$/)[0],
);
const applied = listing.migrations.map((m) => m.remote).filter(Boolean).sort();
const localOnly = listing.migrations.filter((m) => m.local && !m.remote).map((m) => m.local);
fs.writeFileSync(
  path.join(outDir, "applied-migrations.txt"),
  [
    "# Migration versions applied in DocCy - Testing when supabase/ci/schema.sql was dumped.",
    "# scripts/ci-db/load.mjs applies every repo migration NOT listed here.",
    "# Regenerate with: node scripts/ci-db/dump-snapshot.mjs",
    ...applied,
    "",
  ].join("\n"),
);

const exclude = publicTablesOutside(fs.readFileSync(schemaPath, "utf8"), CATALOGUE_TABLES);
console.log(`Dumping catalogue rows (${CATALOGUE_TABLES.join(", ")})…`);
supabase([
  "db",
  "dump",
  "--linked",
  "--data-only",
  "--schema",
  "public",
  ...exclude.flatMap((table) => ["-x", table]),
  "-f",
  "supabase/ci/catalogue.sql",
], { cwd: repoRoot });

console.log(`Snapshot written to supabase/ci/ (${applied.length} applied migrations).`);
if (localOnly.length) {
  console.log(`Not yet in Testing, CI will apply them: ${localOnly.join(", ")}`);
}
