// Reports how far supabase/ci/ (the CI schema snapshot) is from supabase/migrations/.
// Runs in the PR build job; no Docker or database needed. It never fails the build:
// a snapshot behind the repo is harmless, since load.mjs applies the missing migrations
// on every run. Refreshing (npm run db:ci-snapshot, needs Docker) only shortens that list.
//
//   node scripts/ci-db/check-snapshot.mjs
//
// Warns when more than MAX_PENDING repo migrations are missing from the snapshot, and about
// versions the snapshot has that the repo does not (unmerged work applied to Testing).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseAppliedVersions, snapshotFreshness } from "./load-lib.mjs";

const MAX_PENDING = 10;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const inActions = Boolean(process.env.GITHUB_ACTIONS);
const warn = (message) =>
  console.log(inActions ? `::warning title=CI snapshot::${message}` : `Warning: ${message}`);

const applied = parseAppliedVersions(
  fs.readFileSync(path.join(repoRoot, "supabase", "ci", "applied-migrations.txt"), "utf8"),
);
const { pending, snapshotOnly, stale } = snapshotFreshness(
  fs.readdirSync(path.join(repoRoot, "supabase", "migrations")),
  applied,
  MAX_PENDING,
);

if (snapshotOnly.length) {
  warn(
    `The CI snapshot includes migrations applied in Testing that are not in this branch: ${snapshotOnly.join(", ")}. ` +
      "If one of them changes before it merges, refresh the snapshot (npm run db:ci-snapshot).",
  );
}

if (stale) {
  warn(
    `The CI snapshot is ${pending.length} migrations behind supabase/migrations/. CI applies them on every run, ` +
      "so nothing breaks; refresh it when convenient (npm run db:ci-snapshot, needs Docker).",
  );
}

console.log(`CI snapshot: ${pending.length} pending migration(s) applied on load.`);
