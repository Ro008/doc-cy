// Checks that supabase/ci/ (the CI schema snapshot) keeps up with supabase/migrations/.
// Runs in the PR build job; no Docker or database needed.
//
//   node scripts/ci-db/check-snapshot.mjs
//
// Fails when more than MAX_PENDING repo migrations are missing from the snapshot: CI still
// applies them, but the snapshot should be refreshed (npm run db:ci-snapshot, needs Docker).
// Warns, without failing, about versions the snapshot has that the repo does not.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseAppliedVersions, snapshotFreshness } from "./load-lib.mjs";

const MAX_PENDING = 10;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const inActions = Boolean(process.env.GITHUB_ACTIONS);
const applied = parseAppliedVersions(
  fs.readFileSync(path.join(repoRoot, "supabase", "ci", "applied-migrations.txt"), "utf8"),
);
const { pending, snapshotOnly, stale } = snapshotFreshness(
  fs.readdirSync(path.join(repoRoot, "supabase", "migrations")),
  applied,
  MAX_PENDING,
);

if (snapshotOnly.length) {
  const message =
    `The CI snapshot includes migrations applied in Testing that are not in this branch: ${snapshotOnly.join(", ")}. ` +
    "If one of them changes before it merges, refresh the snapshot (npm run db:ci-snapshot).";
  console.log(inActions ? `::warning title=CI snapshot::${message}` : `Warning: ${message}`);
}

if (stale) {
  const message =
    `The CI snapshot is ${pending.length} migrations behind supabase/migrations/ (limit ${MAX_PENDING}). ` +
    "Refresh it: apply the migrations to Testing, run npm run db:ci-snapshot (needs Docker) and commit supabase/ci/.";
  console.log(inActions ? `::error title=CI snapshot::${message}` : `Error: ${message}`);
  process.exit(1);
}

console.log(`CI snapshot OK: ${pending.length} pending migration(s), limit ${MAX_PENDING}.`);
