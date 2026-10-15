import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  LISTING_LOCATION_FILTER_SELECT,
  applyFinderListFilters,
  countUnregisteredClinicCardsForFinder,
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

// One card per professional + clinic (user, 2026-10-15): an unfiltered search pages through
// the listings, so the total comes from counting their unarchived clinic links.
describe("countUnregisteredClinicCardsForFinder", () => {
  function fakeSupabase(result: { count: number | null; error: unknown }) {
    const calls: string[] = [];
    const query = {
      select(columns: string, options: { count?: string; head?: boolean }) {
        calls.push(`select ${columns} ${options.count}/${options.head}`);
        return this;
      },
      eq(column: string, value: unknown) {
        calls.push(`${column}=${String(value)}`);
        return this;
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve(result).then(resolve);
      },
    };
    return {
      calls,
      supabase: {
        from(table: string) {
          calls.push(`from ${table}`);
          return query;
        },
      },
    };
  }

  it("counts each unarchived clinic of an unarchived unregistered listing", async () => {
    const { calls, supabase } = fakeSupabase({ count: 7, error: null });
    const res = await countUnregisteredClinicCardsForFinder(supabase);
    assert.deepEqual(res, { count: 7, error: null });
    assert.deepEqual(calls, [
      "from professional_clinics",
      "select id, professionals!inner(is_registered, is_archived), clinics!inner(is_archived) exact/true",
      "professionals.is_registered=false",
      "professionals.is_archived=false",
      "clinics.is_archived=false",
    ]);
  });

  it("passes the error on", async () => {
    const { supabase } = fakeSupabase({ count: null, error: { message: "boom" } });
    assert.deepEqual(await countUnregisteredClinicCardsForFinder(supabase), {
      count: 0,
      error: { message: "boom" },
    });
  });
});
