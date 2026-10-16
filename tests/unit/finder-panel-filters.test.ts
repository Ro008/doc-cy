import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINDER_PANEL_PRIMARY_LANGUAGES,
  finderCalendarHasSlotWithin,
  finderCardPassesPanelFilters,
  finderPanelFilterCount,
  finderPanelFilterKey,
  finderPanelFilterParams,
  hasFinderPanelFilters,
  parseFinderPanelFilters,
  type FinderPanelFilters,
} from "../../lib/finder-panel-filters";

const none: FinderPanelFilters = { online: false, when: "any", gesy: false, languages: [] };

describe("the filter panel reads its filters from the URL (Finder G, step 3)", () => {
  it("nothing set: no filters", () => {
    assert.deepEqual(parseFinderPanelFilters({}), none);
    assert.equal(hasFinderPanelFilters(none), false);
  });

  it("Book online, Accepts GeSY and the languages", () => {
    assert.deepEqual(
      parseFinderPanelFilters({ online: "1", gesy: "1", lang: "greek,English" }),
      { online: true, when: "any", gesy: true, languages: ["Greek", "English"] },
    );
  });

  it("Today or Next 7 days turn Book online on: only online booking has times", () => {
    assert.deepEqual(parseFinderPanelFilters({ when: "today" }), {
      ...none,
      online: true,
      when: "today",
    });
    assert.equal(parseFinderPanelFilters({ when: "week" }).when, "week");
  });

  it("ignores unknown values, unknown languages and repeats", () => {
    assert.deepEqual(
      parseFinderPanelFilters({ online: "yes", when: "tomorrow", gesy: "0", lang: "greek,klingon,Greek," }),
      { ...none, languages: ["Greek"] },
    );
  });

  it("an array value (repeated param) uses the first one", () => {
    assert.equal(parseFinderPanelFilters({ online: ["1", "0"] }).online, true);
  });
});

describe("the filter panel writes its filters to the URL", () => {
  it("only what is on, languages in lower case", () => {
    assert.deepEqual(finderPanelFilterParams(none), {});
    assert.deepEqual(
      finderPanelFilterParams({ online: true, when: "week", gesy: true, languages: ["Greek", "English"] }),
      { online: "1", when: "week", gesy: "1", lang: "greek,english" },
    );
  });

  it("round-trips", () => {
    const filters: FinderPanelFilters = { online: true, when: "today", gesy: false, languages: ["Russian"] };
    assert.deepEqual(parseFinderPanelFilters(finderPanelFilterParams(filters)), filters);
  });
});

describe("the Filters badge counts what is on", () => {
  it("name, Book online, a time, GeSY and languages count once each", () => {
    assert.equal(finderPanelFilterCount(none, ""), 0);
    assert.equal(finderPanelFilterCount(none, "maria"), 1);
    assert.equal(
      finderPanelFilterCount({ online: true, when: "today", gesy: true, languages: ["Greek", "English"] }, "x"),
      5,
    );
  });
});

describe("which cards the panel keeps", () => {
  const listing = { hasOnlineBooking: false, isGesy: true, languages: [] as string[] };
  const bookable = { hasOnlineBooking: true, isGesy: false, languages: ["Greek", "English"] };

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

  it("languages keep anyone who speaks one of them; listings have none", () => {
    assert.equal(finderCardPassesPanelFilters(bookable, { ...none, languages: ["Russian", "English"] }), true);
    assert.equal(finderCardPassesPanelFilters(bookable, { ...none, languages: ["Russian"] }), false);
    assert.equal(finderCardPassesPanelFilters(listing, { ...none, languages: ["Greek"] }), false);
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

it("the panel shows Greek, English and Russian first", () => {
  assert.deepEqual([...FINDER_PANEL_PRIMARY_LANGUAGES], ["Greek", "English", "Russian"]);
});

describe("Show more remembers its page per filtered list", () => {
  it("the panel's filters are part of the list's scope", async () => {
    const { finderResultsListScope } = await import("../../lib/finder-results-page-state");
    assert.equal(
      finderResultsListScope({ pathname: "/paphos", online: "1", when: "week", gesy: "1", lang: "greek" }),
      "/paphos?online=1&when=week&gesy=1&lang=greek",
    );
    assert.equal(finderResultsListScope({ pathname: "/paphos" }), "/paphos");
  });
});

describe("one key for the name and the panel's filters", () => {
  it("same filters, same key; order of the URL does not matter", () => {
    const a = parseFinderPanelFilters({ gesy: "1", lang: "greek" });
    const b = parseFinderPanelFilters({ lang: "Greek", gesy: "1" });
    assert.equal(finderPanelFilterKey(a, " maria "), finderPanelFilterKey(b, "maria"));
    assert.notEqual(finderPanelFilterKey(a, ""), finderPanelFilterKey(none, ""));
    assert.equal(finderPanelFilterKey(none, ""), "");
  });
});
