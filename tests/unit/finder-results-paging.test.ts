import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFinderResultsPageHref,
  escapeIlikePattern,
  FINDER_RESULTS_PAGE_SIZE,
  finderSpecialtyDbMatchValues,
  parseFinderResultsPage,
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
    assert.equal(parseFinderResultsPage("3"), 2); // unfiltered cap
    assert.equal(parseFinderResultsPage("3", { hasListFilter: true }), 3);
    assert.equal(parseFinderResultsPage("99", { hasListFilter: true }), 20);
    assert.equal(parseFinderResultsPage("0"), 1);
    assert.equal(
      buildFinderResultsPageHref({
        finderPath: "/limassol/dentistry",
        name: "Maria",
        page: 2,
      }),
      "/limassol/dentistry?name=Maria&page=2",
    );
    assert.equal(
      buildFinderResultsPageHref({
        finderPath: "/",
        page: 1,
      }),
      "/",
    );
  });
});
