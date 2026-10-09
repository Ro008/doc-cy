import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  LISTING_LOCATION_FILTER_SELECT,
  applyFinderListFilters,
  finderSelectWithListFilters,
} from "@/lib/finder-manual-directory-load";
import { SPECIALTY_FILTER_SELECT } from "@/lib/specialty-catalogue";

const root = path.resolve(__dirname, "../..");

function recordingQuery() {
  const calls: string[] = [];
  const query = {
    eq(column: string, value: unknown) {
      calls.push(`${column}=${String(value)}`);
      return this;
    },
    ilike(column: string, value: string) {
      calls.push(`${column}~${value}`);
      return this;
    },
    in(column: string, values: readonly string[]) {
      calls.push(`${column} in ${values.join(",")}`);
      return this;
    },
  };
  return { calls, query };
}

const noFilters = { district: "", town: "", name: "", specialty: "" };

/**
 * Point E5: a listing matches a district or town when any of its clinics is there
 * (`professional_clinics` -> `clinics`), never by copies on `professionals`. This
 * replaces the near-me-only "clinic-district extras" merge.
 */
describe("finder list filters go through the clinics (Point E5)", () => {
  it("filters district and town on an unarchived linked clinic", () => {
    const { calls, query } = recordingQuery();
    applyFinderListFilters(query, { ...noFilters, district: "Paphos", town: "Tala" });
    assert.deepEqual(calls, [
      "location_filter.clinics.is_archived=false",
      "location_filter.clinics.district=Paphos",
      "location_filter.clinics.town=Tala",
    ]);
  });

  it("adds no clinic filter without district or town", () => {
    const { calls, query } = recordingQuery();
    applyFinderListFilters(query, { ...noFilters, name: "anna" });
    assert.deepEqual(calls, ["name~%anna%"]);
  });

  it("joins the clinics only when district or town is filtered", () => {
    assert.equal(
      LISTING_LOCATION_FILTER_SELECT,
      "location_filter:professional_clinics!inner(clinics!inner(district, town, is_archived))",
    );
    assert.equal(finderSelectWithListFilters("id", noFilters), "id");
    assert.equal(
      finderSelectWithListFilters("id", { ...noFilters, district: "Nicosia" }),
      `id, ${LISTING_LOCATION_FILTER_SELECT}`,
    );
    assert.equal(
      finderSelectWithListFilters("id", { ...noFilters, town: "Strovolos", specialtyIds: ["s1"] }),
      `id, ${SPECIALTY_FILTER_SELECT}, ${LISTING_LOCATION_FILTER_SELECT}`,
    );
  });

  it("keeps the specialty filter", () => {
    const { calls, query } = recordingQuery();
    applyFinderListFilters(query, { ...noFilters, specialtyIds: [] });
    assert.deepEqual(calls, [
      "specialty_filter.specialty_id in 00000000-0000-0000-0000-000000000000",
    ]);
  });

  it("the finder no longer merges clinic-district extras", () => {
    const loader = readFileSync(path.join(root, "lib/finder-manual-directory-load.ts"), "utf8");
    const page = readFileSync(path.join(root, "app/finder/[[...filters]]/page.tsx"), "utf8");
    for (const name of [
      "extraDistrictManualIds",
      "extrasNotInPrimary",
      "mustChunkExtraManualIds",
      "manualIdsWithClinicInActiveDistrict",
      "loadClinicDistrictExtras",
    ]) {
      assert.ok(!loader.includes(name), `loader still has ${name}`);
      assert.ok(!page.includes(name), `finder page still has ${name}`);
    }
  });
});
