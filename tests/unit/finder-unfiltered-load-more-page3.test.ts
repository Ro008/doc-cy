import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  FINDER_RESULTS_PAGE_SIZE,
  hasMoreFinderResults,
  parseFinderResultsPage,
} from "@/lib/finder-results-paging";
import {
  finderResultsListScope,
  hrefWithoutPageQuery,
  parseFinderResultsPageCookie,
  resolveFinderResultsPage,
  serializeFinderResultsPageCookie,
} from "@/lib/finder-results-page-state";

describe("unfiltered homepage Show more without ?page= in the URL", () => {
  it("still loads 36 professionals on depth 3 (cookie), not clamped to page 2", () => {
    const scope = finderResultsListScope({ pathname: "/" });
    const resultsPage = resolveFinderResultsPage({
      cookieRaw: serializeFinderResultsPageCookie({ page: 3, scope }),
      scope,
      hasListFilter: false,
    });
    assert.equal(resultsPage, 3);
    assert.equal(resultsPage * FINDER_RESULTS_PAGE_SIZE, 36);
    assert.equal(hasMoreFinderResults({
      totalCount: 500,
      visibleCount: 36,
      resultsPage,
      hasListFilter: false,
    }), true);
  });

  it("ignores a leftover ?page=3 once a cookie for this list exists", () => {
    const scope = finderResultsListScope({ pathname: "/" });
    assert.equal(
      resolveFinderResultsPage({
        cookieRaw: serializeFinderResultsPageCookie({ page: 4, scope }),
        scope,
        urlPage: "3",
        hasListFilter: false,
      }),
      4,
    );
  });

  it("does not reuse Show more depth when filters/path change", () => {
    const homeScope = finderResultsListScope({ pathname: "/" });
    const limassolScope = finderResultsListScope({ pathname: "/limassol/dentistry" });
    assert.equal(
      resolveFinderResultsPage({
        cookieRaw: serializeFinderResultsPageCookie({ page: 5, scope: homeScope }),
        scope: limassolScope,
        hasListFilter: true,
      }),
      1,
    );
    assert.equal(parseFinderResultsPageCookie(
      serializeFinderResultsPageCookie({ page: 5, scope: homeScope }),
      limassolScope,
    ), null);
  });

  it("strips ?page= from public search URLs and keeps other filters", () => {
    assert.equal(hrefWithoutPageQuery("/", "page=3"), "/");
    assert.equal(hrefWithoutPageQuery("/", "name=Maria&page=2"), "/?name=Maria");
    assert.equal(hrefWithoutPageQuery("/limassol/dentistry", "page=4"), "/limassol/dentistry");
    assert.equal(hrefWithoutPageQuery("/clinics/paphos", "town=geroskipou"), null);
  });

  it("finder and clinics Show more use a refresh button, not ?page= links", () => {
    const repoRoot = process.cwd();
    for (const relative of [
      path.join("app", "finder", "[[...filters]]", "page.tsx"),
      path.join("app", "clinics", "[[...filters]]", "page.tsx"),
    ]) {
      const source = fs.readFileSync(path.join(repoRoot, relative), "utf8");
      assert.match(source, /FinderLoadMoreButton/);
      assert.match(source, /hasMoreFinderResults\(/);
      assert.match(source, /resolveFinderResultsPage\(/);
      assert.doesNotMatch(source, /navigationReason="finder-load-more"/);
      assert.doesNotMatch(source, /\bpage=\{resultsPage \+ 1\}/);
    }
  });

  it("unfiltered page 2 still offers Show more so patients can reach depth 3", () => {
    assert.equal(parseFinderResultsPage("3"), 3);
    assert.equal(
      hasMoreFinderResults({
        totalCount: 500,
        visibleCount: 24,
        resultsPage: 2,
        hasListFilter: false,
      }),
      true,
    );
  });
});
