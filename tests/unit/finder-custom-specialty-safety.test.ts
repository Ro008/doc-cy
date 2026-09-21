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
 *
 * Since Point C the dropdown is the catalogue limited to specialties that have a
 * professional_specialties row (every label, not only the first), and filters go
 * by catalogue slug/id, so casing cannot drop a row (see specialty-catalogue.test.ts).
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const finderPage = fs.readFileSync(
  path.join(repoRoot, "app", "finder", "[[...filters]]", "page.tsx"),
  "utf8",
);
const catalogueModule = fs.readFileSync(
  path.join(repoRoot, "lib", "specialty-catalogue.ts"),
  "utf8",
);

describe("finder custom-specialty wiring (Sexology regression)", () => {
  it("builds the dropdown from every professional_specialties label, not only the first", () => {
    assert.match(
      finderPage,
      /finderSpecialtyOptionsFromCatalogue\(catalogue,\s*available\)/,
      "Dropdown must come from the catalogue filtered by specialty availability.",
    );
    assert.match(
      catalogueModule,
      /\.from\("specialties"\)\s*\.select\("id, professional_specialties!inner\(/,
      "Availability must go through professional_specialties, which holds every label.",
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
