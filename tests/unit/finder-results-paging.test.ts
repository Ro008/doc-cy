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

  it("phase 1: booking/registered blocks before unregistered; shuffle is stable by seed", () => {
    const input = [
      { kind: "manual" as const, row: { id: "m1" }, distanceKm: null },
      { kind: "registered" as const, row: { id: "r1" }, hasOnlineBooking: true, distanceKm: null },
      { kind: "manual" as const, row: { id: "m2" }, distanceKm: null },
      { kind: "registered" as const, row: { id: "r2" }, hasOnlineBooking: true, distanceKm: null },
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
    const registeredIds = a
      .filter((row) => row.kind === "registered")
      .map((row) => (row.row as { id: string }).id)
      .sort();
    assert.deepEqual(registeredIds, ["r1", "r2"]);
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

  it("three tiers: booking, then registered without booking, then unregistered", () => {
    const ordered = orderUnifiedFinderResultsPhase1(
      [
        { kind: "manual" as const, row: { id: "u1" }, distanceKm: null },
        {
          kind: "registered" as const,
          row: { id: "reg-only" },
          hasOnlineBooking: false,
          distanceKm: null,
        },
        {
          kind: "registered" as const,
          row: { id: "booking" },
          hasOnlineBooking: true,
          distanceKm: null,
        },
        { kind: "manual" as const, row: { id: "u2" }, distanceKm: null },
      ],
      { nearMe: false, shuffleSeed: "/finder" },
    );
    assert.deepEqual(
      ordered.map((row) => (row.row as { id: string }).id),
      ["booking", "reg-only", ...ordered.slice(2).map((row) => (row.row as { id: string }).id)],
    );
    assert.equal((ordered[0]?.row as { id: string }).id, "booking");
    assert.equal((ordered[1]?.row as { id: string }).id, "reg-only");
    assert.deepEqual(
      ordered.slice(2).map((row) => row.kind),
      ["manual", "manual"],
    );
  });

  it("phase 1 near-me: sort tiers first, distance within each group", () => {
    const ordered = orderUnifiedFinderResultsPhase1(
      [
        { kind: "manual" as const, row: { id: "m-far" }, distanceKm: 1 },
        {
          kind: "registered" as const,
          row: { id: "r-far" },
          hasOnlineBooking: true,
          distanceKm: 8,
        },
        { kind: "manual" as const, row: { id: "m-near" }, distanceKm: 0.5 },
        {
          kind: "registered" as const,
          row: { id: "r-near" },
          hasOnlineBooking: true,
          distanceKm: 2,
        },
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

  it("manual shuffle seed is stable for a session on the same list, and rotates per session", () => {
    const scope = "/limassol/dentistry";
    const sessionA = "11111111-1111-4111-8111-111111111111";
    const sessionB = "22222222-2222-4222-8222-222222222222";
    assert.equal(
      buildFinderManualShuffleSeed(scope, sessionA),
      `${sessionA}|${scope}`,
    );
    assert.notEqual(
      buildFinderManualShuffleSeed(scope, sessionA),
      buildFinderManualShuffleSeed(scope, sessionB),
    );

    const manuals = [
      { kind: "manual" as const, row: { id: "m1" }, distanceKm: null, requests30d: 0 },
      { kind: "manual" as const, row: { id: "m2" }, distanceKm: null, requests30d: 0 },
      { kind: "manual" as const, row: { id: "m3" }, distanceKm: null, requests30d: 0 },
    ];
    const orderA = orderUnifiedFinderResultsPhase1(manuals, {
      nearMe: false,
      shuffleSeed: buildFinderManualShuffleSeed(scope, sessionA),
    }).map((row) => (row.row as { id: string }).id);
    const orderAAgain = orderUnifiedFinderResultsPhase1(manuals, {
      nearMe: false,
      shuffleSeed: buildFinderManualShuffleSeed(scope, sessionA),
    }).map((row) => (row.row as { id: string }).id);
    const orderB = orderUnifiedFinderResultsPhase1(manuals, {
      nearMe: false,
      shuffleSeed: buildFinderManualShuffleSeed(scope, sessionB),
    }).map((row) => (row.row as { id: string }).id);
    assert.deepEqual(orderA, orderAAgain);
    assert.notDeepEqual(orderA, orderB);
  });

  it("unregistered buckets: higher 30-day request counts first; ties shuffle by seed", () => {
    const input = [
      { kind: "manual" as const, row: { id: "zero-a" }, distanceKm: null, requests30d: 0 },
      { kind: "manual" as const, row: { id: "high" }, distanceKm: null, requests30d: 9 },
      { kind: "manual" as const, row: { id: "mid-a" }, distanceKm: null, requests30d: 3 },
      { kind: "manual" as const, row: { id: "zero-b" }, distanceKm: null, requests30d: 0 },
      { kind: "manual" as const, row: { id: "mid-b" }, distanceKm: null, requests30d: 3 },
      { kind: "manual" as const, row: { id: "mid-c" }, distanceKm: null, requests30d: 3 },
      {
        kind: "registered" as const,
        row: { id: "booking" },
        hasOnlineBooking: true,
        distanceKm: null,
      },
    ];
    const ordered = orderUnifiedFinderResultsPhase1(input, {
      nearMe: false,
      shuffleSeed: "session-a",
      getUnregisteredRequestCount: (item) =>
        "requests30d" in item ? Number(item.requests30d ?? 0) : 0,
    });
    const ids = ordered.map((row) => (row.row as { id: string }).id);
    assert.equal(ids[0], "booking");
    assert.equal(ids[1], "high");
    assert.deepEqual(ids.slice(2, 5).sort(), ["mid-a", "mid-b", "mid-c"]);
    assert.deepEqual(ids.slice(5).sort(), ["zero-a", "zero-b"]);

    const otherSeed = orderUnifiedFinderResultsPhase1(input, {
      nearMe: false,
      shuffleSeed: "session-b",
      getUnregisteredRequestCount: (item) =>
        "requests30d" in item ? Number(item.requests30d ?? 0) : 0,
    }).map((row) => (row.row as { id: string }).id);
    assert.equal(otherSeed[1], "high");
    assert.notDeepEqual(ids.slice(2, 5), otherSeed.slice(2, 5));
  });

  it("near-me ignores request buckets and sorts unregistered by distance", () => {
    const ordered = orderUnifiedFinderResultsPhase1(
      [
        { kind: "manual" as const, row: { id: "far-hot" }, distanceKm: 8, requests30d: 20 },
        { kind: "manual" as const, row: { id: "near-cold" }, distanceKm: 0.4, requests30d: 0 },
        {
          kind: "registered" as const,
          row: { id: "r-near" },
          hasOnlineBooking: true,
          distanceKm: 1,
        },
      ],
      {
        nearMe: true,
        shuffleSeed: "unused",
        getUnregisteredRequestCount: (item) =>
          "requests30d" in item ? Number(item.requests30d ?? 0) : 0,
      },
    );
    assert.deepEqual(
      ordered.map((row) => (row.row as { id: string }).id),
      ["r-near", "near-cold", "far-hot"],
    );
  });
});
