import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Karina / Sexology incident (2026-09):
 * 1. Finder dropdown only selected `specialty`, so a secondary custom label
 *    never became an option.
 * 2. PostgREST overlaps() is case-sensitive; URL "sexology" dropped stored
 *    "Sexology" before in-memory slug matching could run.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const finderPage = fs.readFileSync(
  path.join(repoRoot, "app", "finder", "[[...filters]]", "page.tsx"),
  "utf8",
);

describe("finder custom-specialty wiring (Sexology regression)", () => {
  it("loads registered specialties[] for the finder dropdown, not only primary specialty", () => {
    assert.match(
      finderPage,
      /registeredSpecialtySelectAttempts\s*=\s*\["specialty, specialties"/,
      "Dropdown source must select specialties[] so approved custom labels appear.",
    );
  });

  it("does not apply the registered-list specialty filter in SQL", () => {
    assert.match(
      finderPage,
      /district:\s*""\s*,\s*town:\s*""\s*,\s*specialty:\s*""/,
      "Registered rows must be specialty-filtered in memory; overlaps() is case-sensitive.",
    );
  });
});
