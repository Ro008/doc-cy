import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { shouldStartLinkNavigationPending } from "@/lib/doccy-navigation";
import {
  buildFinderResultsPageHref,
  FINDER_RESULTS_PAGE_SIZE,
  hasMoreFinderResults,
  parseFinderResultsPage,
} from "@/lib/finder-results-paging";

/**
 * Reproduce the unfiltered homepage Show more hang:
 * URL is /?page=3, no district/specialty/name/near-me, many more professionals exist.
 */
function unfilteredHomepagePaging(requestedPage: string, totalProfessionals: number) {
  const hasListFilter = false;
  const resultsPage = parseFinderResultsPage(requestedPage, { hasListFilter });
  const visibleCount = resultsPage * FINDER_RESULTS_PAGE_SIZE;
  const currentHref = buildFinderResultsPageHref({
    finderPath: "/",
    page: Number(requestedPage),
  });
  const loadMoreHref = buildFinderResultsPageHref({
    finderPath: "/",
    page: resultsPage + 1,
  });
  const currentSearch = new URL(currentHref, "https://doccy.invalid").searchParams.toString();
  return {
    resultsPage,
    visibleCount,
    currentHref,
    loadMoreHref,
    showMore: hasMoreFinderResults({
      totalCount: totalProfessionals,
      visibleCount,
      resultsPage,
      hasListFilter,
    }),
    loadMoreStartsPending: shouldStartLinkNavigationPending(loadMoreHref, "/", currentSearch),
    sameUrlClickStartsPending: shouldStartLinkNavigationPending(currentHref, "/", currentSearch),
  };
}

describe("unfiltered homepage Show more on page 3", () => {
  it("loads 36 professionals instead of clamping ?page=3 back to page 2", () => {
    const state = unfilteredHomepagePaging("3", 500);
    assert.equal(state.resultsPage, 3);
    assert.equal(state.visibleCount, 36);
    assert.equal(state.currentHref, "/?page=3");
  });

  it("keeps Show more pointing at page 4 so the click is a real navigation", () => {
    const state = unfilteredHomepagePaging("3", 500);
    assert.equal(state.showMore, true);
    assert.equal(state.loadMoreHref, "/?page=4");
    assert.equal(state.loadMoreStartsPending, true);
    assert.notEqual(state.loadMoreHref, state.currentHref);
  });

  it("does not start a PendingLink spinner when Show more href is already the current URL", () => {
    // Old cap: parse(3) → 2, loadMoreHref stayed /?page=3, Next.js did not navigate,
    // searchParams never changed, spinner never cleared.
    const state = unfilteredHomepagePaging("3", 500);
    assert.equal(state.sameUrlClickStartsPending, false);
    assert.equal(shouldStartLinkNavigationPending("/?page=3", "/", "page=3"), false);
  });

  it("still offers Show more on unfiltered page 2 so patients can reach page 3", () => {
    const state = unfilteredHomepagePaging("2", 500);
    assert.equal(state.showMore, true);
    assert.equal(state.loadMoreHref, "/?page=3");
    assert.equal(state.loadMoreStartsPending, true);
  });

  it("finder and clinics wire Show more through hasMoreFinderResults", () => {
    const repoRoot = process.cwd();
    for (const relative of [
      path.join("app", "finder", "[[...filters]]", "page.tsx"),
      path.join("app", "clinics", "[[...filters]]", "page.tsx"),
    ]) {
      const source = fs.readFileSync(path.join(repoRoot, relative), "utf8");
      assert.match(source, /hasMoreFinderResults\(/);
      assert.match(source, /hasListFilter/);
    }
  });
});
