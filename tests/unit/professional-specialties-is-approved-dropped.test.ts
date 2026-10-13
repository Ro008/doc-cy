import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// `professional_specialties.is_approved` is dropped. Every row was approved since the
// registration approval writes specialties approved (E8 removed the custom-specialty
// review), so the column, the "specialty under review" state and everything derived from
// it (hasPendingSpecialty, is_specialty_approved, the under-review label) are gone. What
// stays is the registration form's own question: was the specialty picked from the
// catalogue or typed as "Other"? That is `from_catalogue`, not an approval.
const root = path.resolve(__dirname, "../..");

const REMOVED_FILES = [
  // No caller left: the add-specialty path went with the account-review screens.
  "lib/professional-specialty-writes.ts",
  "tests/unit/professional-specialty-writes.test.ts",
];

const DEAD_NAMES = [
  "is_approved",
  "isApproved",
  "is_specialty_approved",
  "isSpecialtyApproved",
  "hasPendingSpecialty",
  "approvedSpecialtyNames",
  "PUBLIC_SPECIALTY_UNDER_REVIEW_LABEL",
  "underReview",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

const rel = (file: string) => path.relative(root, file).replace(/\\/g, "/");

function codeFiles(): string[] {
  return [
    ...["app", "lib", "components", "scripts", "tests/integration", "tests/prod"].flatMap((dir) =>
      existsSync(path.join(root, dir)) ? sourceFiles(path.join(root, dir)) : [],
    ),
    ...readdirSync(path.join(root, "tests"))
      .filter((name) => name.endsWith(".spec.ts"))
      .map((name) => path.join(root, "tests", name)),
    path.join(root, "middleware.ts"),
  ];
}

/** Seeds and fixtures that write specialties; the CI schema snapshot is history, not a seed. */
const SQL_SEEDS = [
  "supabase/ci/fixtures.sql",
  "supabase/ci/seed.sql",
  "supabase/integration_seed_doccy_testing.sql",
  "supabase/integration_restore_manual_test_doctors.sql",
];

describe("professional_specialties.is_approved is gone", () => {
  it("removes the writers nothing calls", () => {
    for (const file of REMOVED_FILES) {
      assert.equal(existsSync(path.join(root, file)), false, `${file} should be deleted`);
    }
  });

  it("is named by no app, lib, component, script or integration code", () => {
    const offenders: string[] = [];
    for (const file of codeFiles()) {
      const text = readFileSync(file, "utf8");
      for (const name of DEAD_NAMES) {
        if (new RegExp(`\\b${name}\\b`).test(text)) offenders.push(`${rel(file)}: ${name}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("is written by no seed or CI fixture", () => {
    const offenders = SQL_SEEDS.filter((file) =>
      /\bis_approved\b/.test(readFileSync(path.join(root, file), "utf8")),
    );
    assert.deepEqual(offenders, []);
  });

  it("has a migration that drops the column", () => {
    const dir = path.join(root, "supabase/migrations");
    const dropping = readdirSync(dir).filter((name) =>
      /alter\s+table\s+(if\s+exists\s+)?(only\s+)?public\.professional_specialties[\s\S]*drop\s+column\s+(if\s+exists\s+)?is_approved/i.test(
        readFileSync(path.join(dir, name), "utf8"),
      ),
    );
    assert.equal(dropping.length, 1, `expected one dropping migration, found ${dropping.join(", ") || "none"}`);
  });

  it("keeps the registration form's from_catalogue question", () => {
    const text = readFileSync(path.join(root, "lib/specialty-submission.ts"), "utf8");
    assert.match(text, /from_catalogue/);
  });
});
