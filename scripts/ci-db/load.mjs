// Loads a freshly started local Supabase stack for CI:
//   schema snapshot → repo migrations the snapshot lacks → catalogue rows → synthetic seed.
// Then prints the stack's URL and keys as KEY=value lines. In CI they become step outputs
// ($GITHUB_OUTPUT), which later steps map onto their env: a workflow-level `env:` would
// win over $GITHUB_ENV and keep pointing the job at the hosted Testing project.
//
//   npx --yes supabase@2.118.0 start -x studio,imgproxy,edge-runtime,logflare,vector,postgres-meta,supavisor
//   node scripts/ci-db/load.mjs
//
// Run it once per fresh stack (`npx --yes supabase@2.118.0 db reset` gives you an empty one again).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { psqlLocal, supabase } from "./cli.mjs";
import { assertLocalDbUrl, parseAppliedVersions, pendingMigrations } from "./load-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ciDir = path.join(repoRoot, "supabase", "ci");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const read = (file) => fs.readFileSync(file, "utf8");

const status = JSON.parse(supabase(["status", "-o", "json"], { cwd: repoRoot }).match(/\{[\s\S]*\}\s*$/)[0]);
assertLocalDbUrl(status.API_URL);
assertLocalDbUrl(status.DB_URL);

const alreadyLoaded = psqlLocal(
  "select to_regclass('public.professionals') is not null;",
  "the load check",
).includes("t");
if (alreadyLoaded) {
  throw new Error("This stack already has the DocCy schema. Reset it first: npx --yes supabase@2.118.0 db reset");
}

// A fresh local stack grants anon/authenticated everything on any new public object.
// The snapshot carries Testing's exact grants (e.g. admin_users: service_role only), so
// drop those defaults first or every table would load more open than in Testing.
// schema.sql ends by setting Testing's own defaults, for the migrations applied below.
psqlLocal(
  ["TABLES", "SEQUENCES", "FUNCTIONS"]
    .map(
      (kind) =>
        `alter default privileges for role postgres in schema public revoke all on ${kind} from anon, authenticated, service_role;`,
    )
    .join("\n"),
  "the default-privileges reset",
);

console.error("Loading schema snapshot…");
psqlLocal(read(path.join(ciDir, "schema.sql")), "supabase/ci/schema.sql");

const applied = parseAppliedVersions(read(path.join(ciDir, "applied-migrations.txt")));
const pending = pendingMigrations(fs.readdirSync(migrationsDir), applied);
for (const file of pending) {
  console.error(`Applying migration ${file}…`);
  psqlLocal(`begin;\n${read(path.join(migrationsDir, file))}\ncommit;`, `migration ${file}`);
}
if (pending.length === 0) console.error("No migrations newer than the snapshot.");

console.error("Loading catalogue and synthetic seed…");
psqlLocal(read(path.join(ciDir, "catalogue.sql")), "supabase/ci/catalogue.sql");
psqlLocal(read(path.join(ciDir, "seed.sql")), "supabase/ci/seed.sql");
psqlLocal("notify pgrst, 'reload schema';", "the PostgREST schema reload");

const outputs = {
  supabase_url: status.API_URL,
  anon_key: status.ANON_KEY,
  service_role_key: status.SERVICE_ROLE_KEY,
};
if (process.env.GITHUB_OUTPUT) {
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
  console.error("Wrote the local stack's URL and keys as step outputs.");
} else {
  console.log(
    [
      `NEXT_PUBLIC_SUPABASE_URL=${outputs.supabase_url}`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${outputs.anon_key}`,
      `SUPABASE_SERVICE_ROLE_KEY=${outputs.service_role_key}`,
    ].join("\n"),
  );
}
