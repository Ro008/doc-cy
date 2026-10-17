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

describe("the search sits in the header (G step 2, then mockup R3)", () => {
  const page = read("app/finder/[[...filters]]/page.tsx");
  const header = read("components/finder/FinderPublicHeader.tsx").replace(/\r\n/g, "\n");
  const search = read("components/finder/FinderHeaderSearch.tsx");

  it("the header takes the search in its own row under the strip", () => {
    assert.match(header, /search\?: React\.ReactNode/);
    assert.match(header, /data-testid="finder-header-search-slot"/);
    assert.match(page, /<FinderPublicHeader[\s\S]*?search=\{\s*<FinderHeaderSearch\b/);
  });

  it("no Join on the Finder (user, 2026-10-16)", () => {
    const finderChrome = header.slice(header.indexOf("if (search) {"), header.indexOf("\n  return (\n    <header"));
    assert.ok(finderChrome.length > 0, "the Finder's own chrome");
    assert.doesNotMatch(finderChrome, /Join as a professional|\/register/);
  });

  it("one District or town picker with Near me and a town search, and Search", () => {
    assert.match(search, /<FinderPlacePicker\b/);
    assert.match(search, />\s*Search\s*</);
    const picker = read("components/finder/FinderPlacePicker.tsx");
    assert.match(picker, /District or town/);
    assert.match(picker, /Near me/);
    assert.match(picker, /suggestFinderTowns\(/);
  });

  it("the hero, its picture, the teal band and the Professionals / Clinics switch are gone", () => {
    for (const gone of ["FinderHeroSection", "FinderSearchBar", "FinderAudienceToggle", "FinderHeroBookOnlineLine"]) {
      assert.doesNotMatch(page, new RegExp(`<${gone}\\b`), gone);
    }
  });

  it("the heading with the count and Clear search under the header", () => {
    assert.match(page, /<h1\b[\s\S]*?\{finderH1\}/);
    assert.match(page, /<FinderResultsCount[\s\S]*?variant="heading"/);
    assert.match(page, /data-testid="finder-clear-search"/);
  });
});
