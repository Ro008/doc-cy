import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { migrationsEnabledForProject } from "../../scripts/lib/supabase-remote-config.mjs";

/**
 * `supabase db push` applied nothing on master (2026-10-16): supabase/config.toml turns
 * migrations off for the local CI stack, and the push read the same switch, so it said
 * "Skipping migrations" and exited 0. The two real projects now turn them back on by project
 * ref ([remotes.*]); the CI stack, which matches neither ref, keeps them off.
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

const TESTING = "fwinchqdgrkpxuuttech";
const PROD = "oiwlztcduxojadbcxkil";

describe("migrationsEnabledForProject", () => {
  it("is true when the project's remote turns migrations on", () => {
    const toml = `
[db.migrations]
enabled = false

[remotes.testing]
project_id = "${TESTING}"

[remotes.testing.db.migrations]
enabled = true
`;
    assert.equal(migrationsEnabledForProject(toml, TESTING), true);
  });

  it("is false for a project with no remote, whatever the global switch says", () => {
    assert.equal(migrationsEnabledForProject(`[db.migrations]\nenabled = false\n`, TESTING), false);
    assert.equal(migrationsEnabledForProject(`[db.migrations]\nenabled = true\n`, TESTING), true);
  });

  it("is false when the remote exists but leaves migrations off or says nothing", () => {
    const off = `[remotes.a]\nproject_id = "${PROD}"\n[remotes.a.db.migrations]\nenabled = false\n`;
    const silent = `[db.migrations]\nenabled = false\n[remotes.a]\nproject_id = "${PROD}"\n`;
    assert.equal(migrationsEnabledForProject(off, PROD), false);
    assert.equal(migrationsEnabledForProject(silent, PROD), false);
  });

  it("matches by project ref, not by the remote's name", () => {
    const toml = `
[db.migrations]
enabled = false
[remotes.production]
project_id = "${PROD}"
[remotes.production.db.migrations]
enabled = true
`;
    assert.equal(migrationsEnabledForProject(toml, PROD), true);
    assert.equal(migrationsEnabledForProject(toml, TESTING), false);
  });

  it("ignores comments and the other remote's switch", () => {
    const toml = `
[db.migrations]
enabled = false
# [remotes.fake.db.migrations]
# enabled = true
[remotes.testing]
project_id = "${TESTING}"
[remotes.testing.db.migrations]
enabled = true # on
[remotes.production]
project_id = "${PROD}"
`;
    assert.equal(migrationsEnabledForProject(toml, TESTING), true);
    assert.equal(migrationsEnabledForProject(toml, PROD), false);
  });
});

describe("the repo's supabase/config.toml", () => {
  const toml = read("supabase/config.toml");

  it("keeps migrations off for the local CI stack", () => {
    assert.match(toml, /\[db\.migrations\]\s*(#[^\n]*\n\s*)*enabled = false/);
    assert.equal(migrationsEnabledForProject(toml, "doc-cy"), false);
  });

  it("turns them on for Testing and Production", () => {
    assert.equal(migrationsEnabledForProject(toml, TESTING), true);
    assert.equal(migrationsEnabledForProject(toml, PROD), true);
  });
});

describe("the push commands", () => {
  const safe = read("scripts/supabase-safe.mjs");
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

  it("refuse to push when the project would skip its migrations", () => {
    assert.match(safe, /migrationsEnabledForProject\(/);
    assert.match(safe, /Skipping migrations|would skip/i);
  });

  it("have a dry run for each project that writes nothing", () => {
    assert.equal(pkg.scripts["db:testing:dry"], "node scripts/supabase-safe.mjs dry-testing");
    assert.equal(pkg.scripts["db:prod:dry"], "node scripts/supabase-safe.mjs dry-prod");
    assert.match(safe, /"--dry-run"/);
  });

  it("the dry run for production needs no confirmation (it only reads)", () => {
    const dryProd = safe.slice(safe.indexOf('case "dry-prod"'), safe.indexOf('case "dry-prod"') + 400);
    assert.doesNotMatch(dryProd, /requireProdConfirmation/);
  });

  it("the runbook says to check with a dry run first", () => {
    const runbook = read("docs/db-release-runbook.md");
    assert.match(runbook, /db:prod:dry/);
    assert.match(runbook, /db:testing:dry/);
  });
});
