import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFinderManualShuffleSeed,
  buildFinderResultsPageHref,
  escapeIlikePattern,
  FINDER_RESULTS_PAGE_SIZE,
  finderSpecialtyDbMatchValues,
  hasMoreFinderResults,
  orderUnifiedFinderResultsPhase1,
  parseFinderResultsPage,
  pinRegisteredTestProfilesFirst,
  shuffleWithSeed,
} from "@/lib/finder-results-paging";

describe("finder results paging helpers", () => {
  it("renders a short first page so patients compare a handful of listings", () => {
    assert.equal(FINDER_RESULTS_PAGE_SIZE, 12);
  });

  it("escapes ilike wildcards", () => {
    assert.equal(escapeIlikePattern("100%_x\\y"), "100\\%\\_x\\\\y");
  });

  it("expands Hematology specialty variants for SQL (British spelling)", () => {
    const values = finderSpecialtyDbMatchValues("Haematology");
    assert.ok(values.includes("Hematology"));
    assert.ok(values.includes("Haematology"));
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

  it("phase 1: registered before manual; manuals shuffle stably by seed", () => {
    const input = [
      { kind: "manual" as const, row: { id: "m1" }, distanceKm: null },
      { kind: "registered" as const, row: { id: "r1" }, distanceKm: null },
      { kind: "manual" as const, row: { id: "m2" }, distanceKm: null },
      { kind: "registered" as const, row: { id: "r2" }, distanceKm: null },
      { kind: "manual" as const, row: { id: "m3" }, distanceKm: null },
    ];
    const a = orderUnifiedFinderResultsPhase1(input, {
      nearMe: false,
      shuffleSeed: "/limassol/dentistry",
    });
    const b = orderUnifiedFinderResultsPhase1(input, {
      nearMe: false,
      shuffleSeed: "/limassol/dentistry",
    });
    assert.deepEqual(
      a.map((row) => row.kind),
      ["registered", "registered", "manual", "manual", "manual"],
    );
    assert.deepEqual(
      a.map((row) => (row.row as { id: string }).id),
      b.map((row) => (row.row as { id: string }).id),
    );
    assert.deepEqual(
      a.filter((row) => row.kind === "registered").map((row) => (row.row as { id: string }).id),
      ["r1", "r2"],
    );
    const otherSeed = orderUnifiedFinderResultsPhase1(input, {
      nearMe: false,
      shuffleSeed: "/nicosia/dentistry",
    });
    const manualA = a
      .filter((row) => row.kind === "manual")
      .map((row) => (row.row as { id: string }).id);
    const manualOther = otherSeed
      .filter((row) => row.kind === "manual")
      .map((row) => (row.row as { id: string }).id);
    assert.notDeepEqual(manualA, ["m1", "m2", "m3"]);
    assert.notDeepEqual(manualA, manualOther);
  });

  it("phase 1 near-me: registered block first, distance within each group", () => {
    const ordered = orderUnifiedFinderResultsPhase1(
      [
        { kind: "manual" as const, row: { id: "m-far" }, distanceKm: 1 },
        { kind: "registered" as const, row: { id: "r-far" }, distanceKm: 8 },
        { kind: "manual" as const, row: { id: "m-near" }, distanceKm: 0.5 },
        { kind: "registered" as const, row: { id: "r-near" }, distanceKm: 2 },
      ],
      { nearMe: true, shuffleSeed: "unused" },
    );
    assert.deepEqual(
      ordered.map((row) => (row.row as { id: string }).id),
      ["r-near", "r-far", "m-near", "m-far"],
    );
  });

  it("shuffleWithSeed is deterministic", () => {
    const items = ["a", "b", "c", "d", "e"];
    assert.deepEqual(shuffleWithSeed(items, "scope-a"), shuffleWithSeed(items, "scope-a"));
    assert.notDeepEqual(shuffleWithSeed(items, "scope-a"), shuffleWithSeed(items, "scope-b"));
  });

  it("manual shuffle seed is stable within a Cyprus day and rotates the next day", () => {
    const scope = "/limassol/dentistry";
    // Noon UTC is always the same calendar day in Europe/Nicosia (UTC+2/+3).
    const dayA = new Date("2026-08-26T12:00:00.000Z");
    const dayALater = new Date("2026-08-26T20:00:00.000Z");
    const dayB = new Date("2026-08-27T12:00:00.000Z");
    assert.equal(
      buildFinderManualShuffleSeed(scope, dayA),
      buildFinderManualShuffleSeed(scope, dayALater),
    );
    assert.equal(buildFinderManualShuffleSeed(scope, dayA), `${scope}|2026-08-26`);
    assert.notEqual(
      buildFinderManualShuffleSeed(scope, dayA),
      buildFinderManualShuffleSeed(scope, dayB),
    );

    const manuals = [
      { kind: "manual" as const, row: { id: "m1" }, distanceKm: null },
      { kind: "manual" as const, row: { id: "m2" }, distanceKm: null },
      { kind: "manual" as const, row: { id: "m3" }, distanceKm: null },
    ];
    const orderA = orderUnifiedFinderResultsPhase1(manuals, {
      nearMe: false,
      shuffleSeed: buildFinderManualShuffleSeed(scope, dayA),
    }).map((row) => (row.row as { id: string }).id);
    const orderB = orderUnifiedFinderResultsPhase1(manuals, {
      nearMe: false,
      shuffleSeed: buildFinderManualShuffleSeed(scope, dayB),
    }).map((row) => (row.row as { id: string }).id);
    assert.notDeepEqual(orderA, orderB);
  });
});
