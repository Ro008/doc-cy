import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFinderResultsPageHref,
  escapeIlikePattern,
  FINDER_RESULTS_PAGE_SIZE,
  finderSpecialtyDbMatchValues,
  hasMoreFinderResults,
  parseFinderResultsPage,
  pinRegisteredTestProfilesFirst,
} from "@/lib/finder-results-paging";

describe("finder results paging helpers", () => {
  it("renders a short first page so patients compare a handful of listings", () => {
    assert.equal(FINDER_RESULTS_PAGE_SIZE, 12);
  });

  it("escapes ilike wildcards", () => {
    assert.equal(escapeIlikePattern("100%_x\\y"), "100\\%\\_x\\\\y");
  });

  it("expands dentistry specialty variants for SQL (GeSY Dentist + legacy)", () => {
    const values = finderSpecialtyDbMatchValues("Dentistry");
    assert.ok(values.includes("Dentist"));
    assert.ok(values.includes("Dentistry"));
    assert.ok(values.includes("Pediatric Dentistry"));
    // Orthodontics is its own GeSY specialty — not collapsed into Dentist.
    assert.ok(!values.includes("Orthodontics"));
  });

  it("parses page and builds href", () => {
    assert.equal(parseFinderResultsPage("3"), 3);
    assert.equal(parseFinderResultsPage("3", { hasListFilter: true }), 3);
    assert.equal(parseFinderResultsPage("99", { hasListFilter: true }), 20);
    assert.equal(parseFinderResultsPage("99"), 20);
    assert.equal(parseFinderResultsPage("0"), 1);
    assert.equal(
      buildFinderResultsPageHref({
        finderPath: "/limassol/dentistry",
        name: "Maria",
      }),
      "/limassol/dentistry?name=Maria",
    );
    assert.equal(
      buildFinderResultsPageHref({
        finderPath: "/paphos",
        town: "tala",
      }),
      "/paphos?town=tala",
    );
    assert.equal(
      buildFinderResultsPageHref({
        finderPath: "/clinics/paphos",
        town: "geroskipou",
      }),
      "/clinics/paphos?town=geroskipou",
    );
    assert.equal(
      buildFinderResultsPageHref({
        finderPath: "/",
      }),
      "/",
    );
  });

  it("pins registered test profiles first for integration first-page asserts", () => {
    const rows = [
      { kind: "manual" as const, row: {} },
      { kind: "registered" as const, row: { isTestProfile: false } },
      { kind: "registered" as const, row: { isTestProfile: true } },
    ];
    pinRegisteredTestProfilesFirst(rows, false);
    assert.equal(rows[0]?.kind, "manual");
    pinRegisteredTestProfilesFirst(rows, true);
    assert.equal(rows[0]?.kind, "registered");
    assert.equal((rows[0]?.row as { isTestProfile?: boolean }).isTestProfile, true);
  });

  it("hides Show more when the next page would be clamped", () => {
    assert.equal(
      hasMoreFinderResults({
        totalCount: 500,
        visibleCount: 24,
        resultsPage: 2,
      }),
      true,
    );
    assert.equal(
      hasMoreFinderResults({
        totalCount: 500,
        visibleCount: 240,
        resultsPage: 20,
      }),
      false,
    );
    assert.equal(
      hasMoreFinderResults({
        totalCount: 12,
        visibleCount: 12,
        resultsPage: 1,
      }),
      false,
    );
  });
});
