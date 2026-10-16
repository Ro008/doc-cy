import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { finderPlaceLabel } from "../../lib/finder-place-label";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

describe("the place picker says what is searched (Finder G, step 2)", () => {
  it("All of Cyprus when no place is picked", () => {
    assert.equal(finderPlaceLabel({ district: "", town: "", nearMe: false }), "All of Cyprus");
  });

  it("the district, or the town with its district", () => {
    assert.equal(finderPlaceLabel({ district: "Paphos", town: "", nearMe: false }), "Paphos");
    assert.equal(finderPlaceLabel({ district: "Paphos", town: "Tala", nearMe: false }), "Tala, Paphos");
    // A town named like its district says so once.
    assert.equal(finderPlaceLabel({ district: "Limassol", town: "Limassol", nearMe: false }), "Limassol");
  });

  it("Near me wins over a place", () => {
    assert.equal(finderPlaceLabel({ district: "", town: "", nearMe: true }), "Near me");
  });
});

describe("G's search sits in the header (user, 2026-10-16)", () => {
  const page = read("app/finder/[[...filters]]/page.tsx");
  const header = read("components/finder/FinderPublicHeader.tsx").replace(/\r\n/g, "\n");
  const search = read("components/finder/FinderHeaderSearch.tsx");

  it("the header takes the search between the logo and the links", () => {
    assert.match(header, /search\?: React\.ReactNode/);
    assert.match(header, /data-testid="finder-header-search-slot"/);
    assert.match(page, /<FinderPublicHeader[\s\S]*?search=\{\s*<FinderHeaderSearch\b/);
  });

  it("as in G: one row from xl with the switch, For professionals and Professional login; no Join", () => {
    assert.match(header, /xl:order-2 xl:flex-\[999_1_480px\]/);
    const finderNav = header.slice(header.indexOf("{search ? (\n          // G"), header.indexOf(") : (\n        <div"));
    assert.ok(finderNav.length > 0, "the Finder's own nav");
    assert.match(finderNav, /<SiteSchemeToggle\b/);
    assert.match(finderNav, />\s*For professionals\s*</);
    assert.match(finderNav, />\s*Professional login\s*</);
    assert.doesNotMatch(finderNav, /Join as a professional|\/register/);
  });

  it("specialty, one District or town picker with Near me, and Search", () => {
    assert.match(search, /<FinderSpecialtyCombobox\b/);
    assert.match(search, /<FinderPlacePicker\b/);
    assert.match(search, />\s*Search\s*</);
    const picker = read("components/finder/FinderPlacePicker.tsx");
    assert.match(picker, /District or town/);
    assert.match(picker, /Near me/);
    assert.match(picker, /suggestFinderTowns\(/);
  });

  it("no name field until the filter panel (step 3); a ?name= link still works", () => {
    assert.doesNotMatch(search, /finder-name-filter/);
    assert.match(search, /activeName/);
  });

  it("the hero, its picture, the teal band and the Professionals / Clinics switch are gone", () => {
    for (const gone of ["FinderHeroSection", "FinderSearchBar", "FinderAudienceToggle", "FinderHeroBookOnlineLine"]) {
      assert.doesNotMatch(page, new RegExp(`<${gone}\\b`), gone);
    }
  });

  it("an intro line under the header, then the heading with the count and Clear search", () => {
    assert.match(page, /data-testid="finder-intro"/);
    assert.match(page, /<h1\b[\s\S]*?\{finderH1\}/);
    assert.match(page, /<FinderResultsCount[\s\S]*?variant="heading"/);
    assert.match(page, /data-testid="finder-clear-search"/);
  });
});
