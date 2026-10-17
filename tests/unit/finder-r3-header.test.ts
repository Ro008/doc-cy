import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PUBLIC_API_RATE_LIMITS } from "../../lib/public-api-rate-limit";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8").replace(/\r\n/g, "\n");
const exists = (file: string) => fs.existsSync(path.join(repoRoot, file));

const page = () => read("app/finder/[[...filters]]/page.tsx");
const header = () => read("components/finder/FinderPublicHeader.tsx");
const search = () => read("components/finder/FinderHeaderSearch.tsx");

describe("no Filters panel (user, 2026-10-16: too few registered professionals)", () => {
  it("the panel, its URL filters and the wide page are gone", () => {
    assert.equal(exists("components/finder/FinderFilterPanel.tsx"), false);
    assert.equal(exists("lib/finder-panel-filters.ts"), false);
    const source = page();
    assert.doesNotMatch(source, /FinderFilterPanel|finder-panel-filters|panelFilters/);
    assert.doesNotMatch(source, /online\?: string|when\?: string|gesy\?: string/);
    assert.doesNotMatch(source, /1564px|1840px|finderWideClass/);
    assert.doesNotMatch(header(), /\bwide\b/);
  });

  it("Show more and the results paging no longer carry online / when / gesy", () => {
    assert.doesNotMatch(read("lib/finder-results-page-state.ts"), /online|gesy|"when"/);
    assert.doesNotMatch(read("components/finder/FinderResultsTransition.tsx"), /get\("online"\)|get\("when"\)|get\("gesy"\)/);
  });
});

describe("the top strip (mockup R3; user, 2026-10-17)", () => {
  it("logo far left, the headline in the middle, the professionals' way in on the right", () => {
    const source = header();
    assert.match(source, /data-testid="finder-top-strip"/);
    assert.match(source, /<FinderHeadline\b/);
    assert.match(source, />\s*Are you a healthcare professional\?\s*</);
    assert.match(source, />\s*Professional login\s*</);
    // The intro line above the header is replaced by the strip.
    assert.doesNotMatch(page(), /data-testid="finder-intro"/);
  });

  it("Cyprus’ doctors, in one search: Plus Jakarta Sans 800, the accent in teal over a swoosh", () => {
    const headline = read("components/finder/FinderHeadline.tsx");
    assert.match(headline, /Plus_Jakarta_Sans\(/);
    assert.match(headline, /weight: "800"/);
    assert.match(headline, /Cyprus’ doctors,/);
    assert.match(headline, /in one search/);
    assert.match(headline, /M3 10 C 45 3, 120 2, 197 7/);
    assert.match(headline, /#0A6B72/);
    assert.match(headline, /#7FE6EB/);
  });

  it("on a phone the question moves to the search row, beside the switch", () => {
    const source = header();
    assert.match(source, /data-testid="finder-row-ask"/);
    assert.match(source, /<SiteSchemeToggle[^>]*iconsOnly/);
  });
});

describe("Light / Dark as two icons on the Finder", () => {
  it("icons only, each with its name for screen readers and a tooltip", () => {
    const toggle = read("components/site/SiteSchemeToggle.tsx");
    assert.match(toggle, /iconsOnly\?: boolean/);
    assert.match(toggle, /title=\{label\}/);
    assert.match(toggle, /aria-label=\{label\}/);
  });
});

describe("one field for Specialty or name, one line each", () => {
  it("the field, its suggestions and the name lookup", () => {
    const source = search();
    assert.match(source, /placeholder="Specialty or name"/);
    assert.match(source, /resolveFinderWhoSubmit\(/);
    assert.match(source, /\/api\/directory\/professional-name-suggestions/);
    assert.match(source, /Every professional named/);
    assert.doesNotMatch(source, /FinderSpecialtyCombobox|FINDER_PANEL_PARAM_KEYS/);
  });

  it("Enter searches what was typed unless a row was picked with the arrow keys", () => {
    const source = search();
    assert.match(source, /const \[highlight, setHighlight\] = React\.useState\(-1\)/);
    assert.match(source, /if \(open && highlight >= 0 && rows\[highlight\]\)/);
  });

  it("a name search drops the specialty, a specialty drops the name", () => {
    const source = search();
    assert.match(source, /params\.set\("name"/);
    assert.doesNotMatch(source, /activeName\.trim\(\)\) params\.set/);
  });

  it("the place picker is one line too", () => {
    const picker = read("components/finder/FinderPlacePicker.tsx");
    assert.doesNotMatch(picker, /uppercase tracking-\[0\.06em\] text-site-ink-600">District or town/);
    assert.match(picker, /aria-label=\{`District or town: \$\{label\}`\}/);
  });

  it("the lookup is rate limited on its own", () => {
    assert.ok(PUBLIC_API_RATE_LIMITS.professionalNameSuggest);
    assert.ok(PUBLIC_API_RATE_LIMITS.professionalNameSuggest.limit >= 200);
    const route = read("app/api/directory/professional-name-suggestions/route.ts");
    assert.match(route, /enforcePublicApiRateLimit\(req, "professionalNameSuggest"/);
    assert.match(route, /\.eq\("is_archived", false\)/);
    assert.match(route, /isRegisteredDoctorHiddenFromFinder\(/);
    assert.match(route, /shapeFinderNameSuggestions\(/);
  });
});

describe("the cards (R3)", () => {
  it("Request online booking is a quieter pale teal", () => {
    const box = read("components/finder/FinderListingRequestBox.tsx");
    assert.doesNotMatch(box, /bg-\[#12B8C0\]/);
    assert.match(box, /bg-\[#E3F4F6\]/);
    assert.match(box, /text-\[#0A5C63\]/);
  });

  it("her own photo opens larger on a click; the default avatars do not", () => {
    const hero = read("components/finder/FinderProfileCardHero.tsx");
    assert.match(hero, /zoomPhoto\?:/);
    assert.match(hero, /<FinderCardPhotoZoom\b/);
    const zoom = read("components/finder/FinderCardPhotoZoom.tsx");
    assert.match(zoom, /cursor-zoom-in/);
    assert.match(zoom, /role="dialog"/);
    assert.match(zoom, /aria-modal="true"/);
    assert.match(zoom, /Escape/);
    const source = page();
    assert.match(source, /hasOwnPhoto/);
    assert.match(source, /zoomPhoto=\{row\.hasOwnPhoto \?/);
  });
});
