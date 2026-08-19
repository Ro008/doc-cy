import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hrefMatchesCurrentLocation, shouldStartLinkNavigationPending } from "@/lib/doccy-navigation";

describe("hrefMatchesCurrentLocation", () => {
  it("treats Show more to the same ?page= as already there", () => {
    assert.equal(hrefMatchesCurrentLocation("/?page=3", "/", "page=3"), true);
    assert.equal(hrefMatchesCurrentLocation("/?page=3", "/", "page=2"), false);
    assert.equal(hrefMatchesCurrentLocation("/?page=3", "/", ""), false);
    assert.equal(shouldStartLinkNavigationPending("/?page=3", "/", "page=3"), false);
    assert.equal(shouldStartLinkNavigationPending("/?page=4", "/", "page=3"), true);
  });

  it("compares pathname and search independently", () => {
    assert.equal(
      hrefMatchesCurrentLocation("/limassol/dentistry?page=2", "/limassol/dentistry", "page=2"),
      true,
    );
    assert.equal(
      hrefMatchesCurrentLocation("/limassol/dentistry?page=2", "/paphos/dentistry", "page=2"),
      false,
    );
  });
});
