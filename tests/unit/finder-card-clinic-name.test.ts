import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), "utf8");

/**
 * Registered cards used to show a bare `professionals.clinic_address` string while
 * unregistered ones showed a linked clinic name, because only the manual path read
 * `professional_clinics -> clinics`. Both now render the same heading component.
 */
describe("finder card clinic name", () => {
  it("renders the clinic heading from one shared component, not two copies", () => {
    const column = read("components/finder/FinderCardClinicColumn.tsx");
    const registered = read("components/finder/FinderRegisteredCardAvailability.tsx");
    const manual = read("components/finder/FinderManualLocationCalendars.tsx");

    // G (step 4): both finder card types use the same clinic column, so they cannot
    // drift apart visually; the listing page keeps FinderClinicLocationBlock.
    assert.equal(column.includes("clinicLandingPath(slug)"), true);
    assert.equal(registered.includes("<FinderCardClinicColumn"), true);
    assert.equal(manual.includes("<FinderCardClinicColumn"), true);
    assert.equal(read("components/finder/FinderClinicLocationBlock.tsx").includes("export function FinderClinicNameLink"), true);
  });

  it("keys registered clinics by the professional_clinics row id", () => {
    const loader = read("lib/public/load-finder-registered-clinics.ts");
    const registered = read("components/finder/FinderRegisteredCardAvailability.tsx");

    // Stage 1 reused doctor_locations.id as the join-row id, which is what makes a
    // rendered location resolve to exactly one clinic. Matching on address instead
    // would be guesswork, and the work plan forbids treating addresses as identity.
    assert.equal(loader.includes('.from("professional_clinics")'), true);
    assert.equal(loader.includes("id, professional_id, sort_order, created_at, clinics ("), true);
    assert.equal(loader.includes("byLocationId"), true);
    // The join-row lookup now happens inside clinicForRenderedLocation, which also
    // refuses a fallback clinic that sits at a different address (see
    // tests/unit/finder-card-clinic-match.test.ts).
    assert.equal(registered.includes("clinicForRenderedLocation"), true);
    assert.equal(registered.includes("byLocationId: registeredClinics.byLocationId"), true);
    assert.equal(registered.includes("locationId: location?.id ?? null"), true);

    // Chunked id filtering, per the repo's supabase row-cap rules.
    assert.equal(loader.includes("fetchAllSupabaseRowsForIdChunks"), true);
    assert.equal(loader.includes("ids.join("), false);
  });

  it("never links a clinic that has no public page", () => {
    const loader = read("lib/public/load-finder-registered-clinics.ts");

    // An archived clinic is filtered out of load-clinic-by-slug, so linking to one
    // would 404. The manual builder skips them; this must too.
    assert.equal(loader.includes("clinic.is_archived"), true);
    assert.equal(loader.includes("if (!name || !slug) continue;"), true);
  });
});
