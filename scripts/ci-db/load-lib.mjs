// Pure helpers for scripts/ci-db/load.mjs (unit-tested in tests/unit/ci-db-load.test.ts).

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const VERSION_RE = /^\d{14}$/;
const MIGRATION_FILE_RE = /^(\d{14})_.+\.sql$/;

/** Throws unless `url` points at a local Supabase stack (API or Postgres URL). */
export function assertLocalDbUrl(url) {
  let host = "";
  try {
    host = new URL(String(url ?? "")).hostname;
  } catch {
    host = "";
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Refusing to load CI data: "${url ?? ""}" is not a local Supabase stack.`);
  }
}

/**
 * Parses supabase/ci/applied-migrations.txt: the migration versions the schema snapshot
 * already contains, one per line (`#` comments and blank lines allowed).
 */
export function parseAppliedVersions(text) {
  const versions = new Set();
  String(text)
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const line = raw.trim();
      if (!line || line.startsWith("#")) return;
      if (!VERSION_RE.test(line)) {
        throw new Error(`applied-migrations.txt line ${index + 1}: "${line}" is not a 14-digit version.`);
      }
      versions.add(line);
    });
  if (versions.size === 0) {
    throw new Error("applied-migrations.txt lists no versions.");
  }
  return versions;
}

/**
 * Public tables in a pg_dump schema that are NOT in `allowlist`, as `public.<name>`, for
 * `supabase db dump --data-only -x …`. Computed from the schema so a new table is excluded
 * until someone allowlists it: only catalogue data may be copied out of Testing.
 */
export function publicTablesOutside(schemaSql, allowlist) {
  const tables = new Set();
  for (const match of String(schemaSql).matchAll(
    /^CREATE TABLE (?:IF NOT EXISTS )?"?public"?\."?([a-z0-9_]+)"? \(/gm,
  )) {
    tables.add(match[1]);
  }
  for (const name of allowlist) {
    if (!tables.has(name)) {
      throw new Error(`Allowlisted table public.${name} is not in the schema snapshot.`);
    }
  }
  return [...tables]
    .filter((name) => !allowlist.includes(name))
    .sort()
    .map((name) => `public.${name}`);
}

/**
 * How far supabase/ci/ is from the repo's migrations.
 * - pending: repo versions the snapshot lacks (CI applies them on every run)
 * - snapshotOnly: versions applied in Testing but not in the repo (unmerged work baked
 *   into the snapshot; if that migration changes before merge, CI skips the new version)
 * - stale: more than `maxPending` pending, time to refresh the snapshot
 */
export function snapshotFreshness(fileNames, appliedVersions, maxPending) {
  const repoVersions = fileNames
    .map((name) => name.match(MIGRATION_FILE_RE)?.[1])
    .filter(Boolean);
  const repoSet = new Set(repoVersions);
  const pending = repoVersions.filter((version) => !appliedVersions.has(version)).sort();
  const snapshotOnly = [...appliedVersions].filter((version) => !repoSet.has(version)).sort();
  return { pending, snapshotOnly, stale: pending.length > maxPending };
}

/** Repo migration files whose version the snapshot has not applied, oldest first. */
export function pendingMigrations(fileNames, appliedVersions) {
  return fileNames
    .map((name) => ({ name, match: name.match(MIGRATION_FILE_RE) }))
    .filter(({ match }) => match && !appliedVersions.has(match[1]))
    .map(({ name }) => name)
    .sort();
}
