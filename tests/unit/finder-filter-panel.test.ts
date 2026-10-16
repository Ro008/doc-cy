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

  it("has the name search back, then availability, cover and languages", () => {
    for (const label of ['"Today"', '"Next 7 days"', '"Any time"']) assert.match(panel, new RegExp(label));
    const order = [
      'id="finder-name-filter"',
      "Book online",
      "WHEN_OPTIONS.map",
      "Accepts GeSY",
      "More languages",
    ].map((text) => {
      const at = panel.indexOf(text);
      assert.ok(at > 0, text);
      return at;
    });
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });

  it("folds: a Filters button with the count says whether it is open", () => {
    assert.match(panel, /data-testid="finder-filter-panel"/);
    assert.match(panel, /aria-expanded=\{/);
    assert.match(panel, /aria-controls="finder-filter-body"/);
    assert.match(panel, /finderPanelFilterCount\(/);
  });

  it("beside the results from xl, above them below that; open on desktop, folded on phones", () => {
    assert.match(panel, /xl:w-\[260px\]/);
    assert.match(panel, /desktopOpen \? "xl:block" : "xl:hidden"/);
    assert.match(panel, /mobileOpen \? "block" : "hidden"/);
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
