import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  needsPublicSearchHardNavigation,
  publicSearchPathname,
  shouldShowFinderResultsSkeleton,
} from "@/lib/public-search-navigation";

describe("public search navigation", () => {
  it("strips query and hash from hrefs", () => {
    assert.equal(publicSearchPathname("/clinics?name=foo"), "/clinics");
    assert.equal(publicSearchPathname("/larnaca/dentistry#results"), "/larnaca/dentistry");
    assert.equal(publicSearchPathname("/"), "/");
  });

  it("keeps App Router soft-nav for real pages (switcher)", () => {
    assert.equal(needsPublicSearchHardNavigation("/"), false);
    assert.equal(needsPublicSearchHardNavigation("/?name=Maria"), false);
    assert.equal(needsPublicSearchHardNavigation("/clinics"), false);
    assert.equal(needsPublicSearchHardNavigation("/clinics/paphos"), false);
    assert.equal(needsPublicSearchHardNavigation("/clinics?name=Sunrise"), false);
  });

  it("keeps App Router soft-nav for district/specialty finder URLs", () => {
    assert.equal(needsPublicSearchHardNavigation("/larnaca"), false);
    assert.equal(needsPublicSearchHardNavigation("/larnaca/dentistry"), false);
    assert.equal(needsPublicSearchHardNavigation("/all/gynecology"), false);
    assert.equal(needsPublicSearchHardNavigation("/andreas-nikos"), false);
  });

  it("shows result skeletons for filter and switcher taps, not profile opens", () => {
    assert.equal(shouldShowFinderResultsSkeleton({ reason: "finder-results" }), true);
    assert.equal(shouldShowFinderResultsSkeleton({ reason: "finder-near-me" }), true);
    assert.equal(shouldShowFinderResultsSkeleton({ reason: "clinics-near-me" }), true);
    assert.equal(
      shouldShowFinderResultsSkeleton({ reason: "default", linkKey: "/clinics/paphos" }),
      true,
    );
    assert.equal(
      shouldShowFinderResultsSkeleton({ reason: "default", linkKey: "/larnaca/dentistry" }),
      true,
    );
    assert.equal(
      shouldShowFinderResultsSkeleton({ reason: "profile", linkKey: "/andreas-nikos" }),
      false,
    );
    assert.equal(
      shouldShowFinderResultsSkeleton({
        reason: "finder-load-more",
        linkKey: "/larnaca/dentistry?page=2",
      }),
      false,
    );
    assert.equal(
      shouldShowFinderResultsSkeleton({ reason: "default", linkKey: "/agenda" }),
      false,
    );
  });

  it("Show more CTAs keep scroll and skip result skeletons", () => {
    const repoRoot = process.cwd();
    const finder = fs.readFileSync(
      path.join(repoRoot, "app", "finder", "[[...filters]]", "page.tsx"),
      "utf8",
    );
    const clinics = fs.readFileSync(
      path.join(repoRoot, "app", "clinics", "[[...filters]]", "page.tsx"),
      "utf8",
    );
    for (const source of [finder, clinics]) {
      assert.match(source, /scroll=\{false\}/);
      assert.match(source, /navigationReason="finder-load-more"/);
    }
  });
});
