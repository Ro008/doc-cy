import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINDER_PANEL_PARAM_KEYS,
  finderCalendarHasSlotWithin,
  finderCardPassesPanelFilters,
  finderPanelExcludesListings,
  finderPanelFilterCount,
  finderPanelFilterKey,
  finderPanelFilterParams,
  hasFinderPanelFilters,
  parseFinderPanelFilters,
  type FinderPanelFilters,
} from "../../lib/finder-panel-filters";
import { finderResultsListScope } from "../../lib/finder-results-page-state";

const none: FinderPanelFilters = { online: false, when: "any", gesy: false };

describe("the filter panel reads its filters from the URL (Finder G, step 3)", () => {
  it("nothing set: no filters", () => {
    assert.deepEqual(parseFinderPanelFilters({}), none);
    assert.equal(hasFinderPanelFilters(none), false);
  });

  it("Book online and Accepts GeSY", () => {
    assert.deepEqual(parseFinderPanelFilters({ online: "1", gesy: "1" }), {
      online: true,
      when: "any",
      gesy: true,
    });
  });

  it("Today or Next 7 days turn Book online on: only online booking has times", () => {
    assert.deepEqual(parseFinderPanelFilters({ when: "today" }), { ...none, online: true, when: "today" });
    assert.equal(parseFinderPanelFilters({ when: "week" }).when, "week");
  });

  it("ignores unknown values", () => {
    assert.deepEqual(parseFinderPanelFilters({ online: "yes", when: "tomorrow", gesy: "0" }), none);
  });

  it("an array value (repeated param) uses the first one", () => {
    assert.equal(parseFinderPanelFilters({ online: ["1", "0"] }).online, true);
  });

  it("no languages for now (user, 2026-10-16): an old ?lang= link filters nothing", () => {
    assert.deepEqual(
      parseFinderPanelFilters({ lang: "greek" } as Parameters<typeof parseFinderPanelFilters>[0]),
      none,
    );
    assert.deepEqual([...FINDER_PANEL_PARAM_KEYS], ["online", "when", "gesy"]);
  });
});

describe("the filter panel writes its filters to the URL", () => {
  it("only what is on", () => {
    assert.deepEqual(finderPanelFilterParams(none), {});
    assert.deepEqual(finderPanelFilterParams({ online: true, when: "week", gesy: true }), {
      online: "1",
      when: "week",
      gesy: "1",
    });
  });

  it("round-trips", () => {
    const filters: FinderPanelFilters = { online: true, when: "today", gesy: false };
    assert.deepEqual(parseFinderPanelFilters(finderPanelFilterParams(filters)), filters);
  });
});

describe("the Filters badge counts what is on", () => {
  it("name, Book online, a time and GeSY count once each", () => {
    assert.equal(finderPanelFilterCount(none, ""), 0);
    assert.equal(finderPanelFilterCount(none, "maria"), 1);
    assert.equal(finderPanelFilterCount({ online: true, when: "today", gesy: true }, "x"), 4);
  });
});

describe("which cards the panel keeps", () => {
  const listing = { hasOnlineBooking: false, isGesy: true };
  const bookable = { hasOnlineBooking: true, isGesy: false };

  it("no filters keeps every card", () => {
    assert.equal(finderCardPassesPanelFilters(listing, none), true);
    assert.equal(finderCardPassesPanelFilters(bookable, none), true);
  });

  it("Book online keeps cards that book online at that clinic", () => {
    const f = { ...none, online: true };
    assert.equal(finderCardPassesPanelFilters(listing, f), false);
    assert.equal(finderCardPassesPanelFilters(bookable, f), true);
  });

  it("Accepts GeSY keeps GeSY professionals", () => {
    const f = { ...none, gesy: true };
    assert.equal(finderCardPassesPanelFilters(listing, f), true);
    assert.equal(finderCardPassesPanelFilters(bookable, f), false);
  });

  it("Today / Next 7 days ask the clinic's calendar, 1 or 7 days", () => {
    const asked: number[] = [];
    const f: FinderPanelFilters = { ...none, online: true, when: "week" };
    const pass = finderCardPassesPanelFilters(bookable, f, {
      hasSlotWithinDays: (days) => {
        asked.push(days);
        return days >= 7;
      },
    });
    assert.equal(pass, true);
    assert.deepEqual(asked, [7]);
    assert.equal(
      finderCardPassesPanelFilters(bookable, { ...f, when: "today" }, { hasSlotWithinDays: (d) => d >= 7 }),
      false,
    );
  });

  it("a time filter with no calendar keeps nothing", () => {
    assert.equal(finderCardPassesPanelFilters(bookable, { ...none, online: true, when: "today" }), false);
  });
});

describe("a calendar has a free time within N days", () => {
  const day = (n: number) => ({ slots: new Array(n).fill({}) });

  it("today only looks at the first day", () => {
    assert.equal(finderCalendarHasSlotWithin([day(0), day(2)], 1), false);
    assert.equal(finderCalendarHasSlotWithin([day(1)], 1), true);
  });

  it("next 7 days looks at the first seven", () => {
    const days = [0, 0, 0, 0, 0, 0, 0, 3].map(day);
    assert.equal(finderCalendarHasSlotWithin(days, 7), false);
    assert.equal(finderCalendarHasSlotWithin(days, 8), true);
    assert.equal(finderCalendarHasSlotWithin([], 7), false);
  });
});

describe("Show more remembers its page per filtered list", () => {
  it("the panel's filters are part of the list's scope", () => {
    assert.equal(
      finderResultsListScope({ pathname: "/paphos", online: "1", when: "week", gesy: "1" }),
      "/paphos?online=1&when=week&gesy=1",
    );
    assert.equal(finderResultsListScope({ pathname: "/paphos" }), "/paphos");
  });
});

describe("one key for the name and the panel's filters", () => {
  it("same filters, same key; order of the URL does not matter", () => {
    const a = parseFinderPanelFilters({ gesy: "1", online: "1" });
    const b = parseFinderPanelFilters({ online: "1", gesy: "1" });
    assert.equal(finderPanelFilterKey(a, " maria "), finderPanelFilterKey(b, "maria"));
    assert.notEqual(finderPanelFilterKey(a, ""), finderPanelFilterKey(none, ""));
    assert.equal(finderPanelFilterKey(none, ""), "");
  });
});

describe("listings are not loaded when the panel rules them all out", () => {
  it("Book online (and so a time): no listing can match", () => {
    assert.equal(finderPanelExcludesListings(none), false);
    assert.equal(finderPanelExcludesListings({ ...none, gesy: true }), false);
    assert.equal(finderPanelExcludesListings({ ...none, online: true }), true);
    assert.equal(finderPanelExcludesListings({ ...none, online: true, when: "today" }), true);
  });
});
