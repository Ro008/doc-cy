import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) =>
  fs.readFileSync(path.join(repoRoot, file), "utf8").replace(/\r\n/g, "\n");

const panel = read("components/finder/FinderFilterPanel.tsx");
const page = read("app/finder/[[...filters]]/page.tsx");
const search = read("components/finder/FinderHeaderSearch.tsx");

describe("the filter panel (Finder G, step 3)", () => {
  it("shows once a search is on, around the results", () => {
    assert.match(page, /<FinderFilterPanel\s+show=\{hasListFilter\}[^>]*>\s*<section className="mt-6">/);
    assert.match(panel, /if \(!show\) return <>\{children\}<\/>;/);
  });

  it("has the name search back, then availability and cover; no languages for now", () => {
    for (const label of ['"Today"', '"Next 7 days"', '"Any time"']) assert.match(panel, new RegExp(label));
    const order = [
      'id="finder-name-filter"',
      "Book online",
      "WHEN_OPTIONS.map",
      "Accepts GeSY",
    ].map((text) => {
      const at = panel.indexOf(text);
      assert.ok(at > 0, text);
      return at;
    });
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    // User, 2026-10-16: with so few registered professionals it only hid the directory.
    assert.doesNotMatch(panel, />Languages<|More languages|toggleLanguage/);
  });

  it("folds: a Filters button with the count says whether it is open", () => {
    assert.match(panel, /data-testid="finder-filter-panel"/);
    assert.match(panel, /aria-expanded=\{/);
    assert.match(panel, /aria-controls="finder-filter-body"/);
    assert.match(panel, /finderPanelFilterCount\(/);
  });

  it("in the left margin on wide screens, so the cards keep their full width; above them narrower", () => {
    // The user's sketch (2026-10-16): the cards never give up width to the filters.
    const has = (text: string) => assert.ok(panel.includes(text), text);
    has('const WIDE_QUERY = "(min-width: 1840px)"');
    // G (user, 2026-10-16): a 260 px column, then the cards at their full 1216 px.
    has(
      '<div className="min-[1840px]:grid min-[1840px]:grid-cols-[260px_minmax(0,1fr)] min-[1840px]:items-start min-[1840px]:gap-x-6">',
    );
    has("min-[1840px]:sticky min-[1840px]:top-4");
    assert.match(panel, /<\/aside>\s*\{children\}\s*<\/div>/);
    assert.ok(!panel.includes("min-[1840px]:absolute"));
    has('wideOpen ? "min-[1840px]:block" : "min-[1840px]:hidden"');
    has('narrowOpen ? "block" : "hidden"');
  });

  it("Book online is a switch; turning it off clears Today / Next 7 days", () => {
    assert.match(panel, /role="switch"/);
    assert.match(panel, /online: !filters\.online, when: filters\.online \? "any" : filters\.when/);
  });

  it("each change goes to the URL (the server filters), back to the first page", () => {
    assert.match(panel, /finderPanelFilterParams\(/);
    assert.match(panel, /params\.delete\("page"\)/);
    assert.match(panel, /router\.push\(/);
  });

  it("Clear filters keeps the search and drops the name and the panel's filters", () => {
    assert.match(panel, /Clear filters/);
  });
});

describe("the results always match the address (Next 14.2 keeps the first load under the bare path)", () => {
  it("reads the page again once when the server built it for other filters", () => {
    assert.match(page, /serverFilterKey=\{finderPanelFilterKey\(panelFilters, activeName\)\}/);
    assert.match(panel, /finderPanelFilterKey\(\s*parseFinderPanelFilters\(/);
    assert.match(panel, /router\.refresh\(\)/);
    assert.match(panel, /asked\.current === current/);
  });
});

describe("a new search from the header keeps the panel's filters", () => {
  it("copies them from the URL", () => {
    assert.match(search, /FINDER_PANEL_PARAM_KEYS/);
  });
});

describe("G's results area once a search is on (user, 2026-10-16)", () => {
  const header = read("components/finder/FinderPublicHeader.tsx");

  it("one wider column from 1840 px: intro, header, heading and results share a left edge", () => {
    assert.ok(page.includes('const finderWideClass = hasListFilter ? "min-[1840px]:max-w-[1564px]" : "";'));
    assert.equal(page.match(/\$\{finderWideClass\}/g)?.length, 3, "intro, heading, results");
    assert.match(page, /<FinderPublicHeader[\s\S]*?wide=\{hasListFilter\}/);
    assert.ok(header.includes('wide ? "min-[1840px]:max-w-[1564px]" : ""'));
  });

  it("the heading sits right above the filters and the cards: nothing in between", () => {
    assert.doesNotMatch(page, /Looking for urgent care in Paphos/);
    assert.match(page, /\{hasListFilter \? null : <FinderRecentlyViewed kind="professional" \/>\}/);
  });
});
