import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchesSpecialtyFilter } from "../../lib/finder-specialty-filter";

describe("matchesSpecialtyFilter", () => {
  it("matches canonical slug pairs", () => {
    assert.equal(matchesSpecialtyFilter("Dentistry", "Dentistry"), true);
    assert.equal(matchesSpecialtyFilter("ENT", "ENT"), true);
  });

  it('does not let "ENT" match Dentistry via substring', () => {
    assert.equal(matchesSpecialtyFilter("Dentistry", "ENT"), false);
    assert.equal(matchesSpecialtyFilter("Pediatric Dentistry", "ENT"), false);
  });

  it("still allows longer fuzzy specialty queries", () => {
    assert.equal(matchesSpecialtyFilter("Dermatology", "dermat"), true);
  });
});
