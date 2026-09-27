import { spawnSync } from "node:child_process";

// Pinned: local Auth/PostgREST versions follow the CLI, not the hosted projects.
// The PR workflow starts the stack with this same version.
export const SUPABASE_CLI = "supabase@2.118.0";
export const TESTING_REF = "fwinchqdgrkpxuuttech";
export const DB_CONTAINER = "supabase_db_doc-cy";

/** Runs the pinned Supabase CLI; returns stdout, throws with stderr on failure. */
export function supabase(args, { input, cwd } = {}) {
  const result = spawnSync("npx", ["--yes", SUPABASE_CLI, ...args], {
    cwd,
    encoding: "utf8",
    input: input ?? "",
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`supabase ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

/** Runs SQL inside the local stack's Postgres container (never a hosted database). */
export function psqlLocal(sql, label) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
    { encoding: "utf8", input: sql, maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`Loading ${label} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}
