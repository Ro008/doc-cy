import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8").replace(/\r\n/g, "\n");

const header = () => read("components/finder/FinderPublicHeader.tsx");

describe("every public page gets the Finder's top strip (user, 2026-10-17)", () => {
  it("profiles, listings and clinic pages: the strip without the headline or a search row", () => {
    const source = header();
    // One strip for both kinds of page; only the Finder adds the headline and the search row.
    assert.match(source, /function FinderTopStrip\b/);
    assert.equal(source.match(/<FinderTopStrip\b/g)?.length, 2);
    assert.match(source, /headline=\{<FinderHeadline\b/);
    assert.match(source, /data-testid="finder-top-strip"/);
  });

  it("the professionals' way in is the question and Professional login; no For professionals, no Join", () => {
    const source = header();
    assert.doesNotMatch(source, />\s*For professionals\s*</);
    assert.doesNotMatch(source, /Join as a professional/);
    assert.doesNotMatch(source, /href="\/register"/);
    assert.match(source, />\s*Are you a healthcare professional\?\s*</);
    assert.match(source, />\s*Professional login\s*</);
  });

  it("Light / Dark is the two icons on every public page", () => {
    const source = header();
    assert.doesNotMatch(source, /<SiteSchemeToggle(?![^>]*iconsOnly)[^>]*\/>/);
  });

  it("the profile no longer wraps the header in its own bar", () => {
    const page = read("lib/public/doctor-profile-page.tsx");
    assert.doesNotMatch(page, /border-b border-profile-border bg-profile-surface">\s*<FinderPublicHeader/);
  });
});

describe("a bigger logo in the public header (user, 2026-10-17)", () => {
  it("a new lg size, taller than the 32 px md, used by the public header", () => {
    const mark = read("components/brand/DocCyWordmark.tsx");
    assert.match(mark, /size\?: "md" \| "lg" \| "xl"/);
    const lg = mark.match(/lg: (\d+)/);
    assert.ok(lg && Number(lg[1]) >= 40, "lg is at least 40 px");
    assert.match(header(), /size=\{isSales \? "xl" : "lg"\}|const logoSize = isSales \? "xl" : "lg"/);
  });
});

describe("the loading screen matches the Finder (user, 2026-10-17 screenshot)", () => {
  const loading = () => read("components/finder/FinderSearchRouteLoading.tsx");

  it("the Finder's loading screen has the R3 header with a still search row", () => {
    const source = loading();
    assert.match(source, /<FinderPublicHeader[\s\S]*?search=\{<FinderHeaderSearchSkeleton \/>\}/);
    const still = read("components/finder/FinderHeaderSearchSkeleton.tsx");
    assert.match(still, /Specialty or name/);
    assert.match(still, /District or town/);
    assert.match(still, /aria-hidden/);
  });

  it("placeholder cards in the shape of today's cards, with a shimmer and the swoosh drawing in", () => {
    const skeleton = read("components/finder/FinderResultsListSkeleton.tsx");
    assert.match(skeleton, /finderProfileCardClass/);
    assert.match(skeleton, /finder-skeleton-shimmer/);
    assert.match(skeleton, /grid-cols-7/);
    const css = read("app/globals.css");
    assert.match(css, /@keyframes finder-skeleton-sweep/);
    assert.match(css, /@keyframes finder-swoosh-draw/);
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]*finder-skeleton-shimmer/);
    assert.match(read("components/finder/FinderHeadline.tsx"), /drawSwoosh\?: boolean/);
    // The page's own background, not the old grey.
    assert.match(loading(), /bg-\[#ECF2F4\]/);
  });

  it("the Clinics tab loads under its own header, not the Finder's search", () => {
    assert.match(read("app/clinics/[[...filters]]/loading.tsx"), /ClinicsRouteLoading/);
    assert.match(loading(), /export function ClinicsSearchRouteLoadingView\b/);
    assert.match(read("app/clinics/[[...filters]]/page.tsx"), /<ClinicsSearchRouteLoadingView\b/);
  });
});

describe("the GeSY badge's tooltip never widens a phone page (found 2026-10-17)", () => {
  it("takes no room until hover or focus, so the profile does not scroll sideways at 375 px", () => {
    const badge = read("components/brand/GesyProviderBadge.tsx");
    assert.match(badge, /hidden shadow-md group-hover:block group-focus-within:block/);
    assert.doesNotMatch(badge, /opacity-0 shadow-md group-hover:opacity-100/);
  });
});
