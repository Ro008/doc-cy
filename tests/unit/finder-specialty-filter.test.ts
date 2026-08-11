import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  matchesAnySpecialtyFilter,
  matchesSpecialtyFilter,
} from "../../lib/finder-specialty-filter";

describe("matchesSpecialtyFilter", () => {
  it("matches canonical slug pairs (incl. legacy→GeSY bridges)", () => {
    assert.equal(matchesSpecialtyFilter("Dentistry", "Dentistry"), true);
    assert.equal(matchesSpecialtyFilter("Dentist", "Dentistry"), true);
    assert.equal(matchesSpecialtyFilter("ENT", "ENT"), true);
    assert.equal(matchesSpecialtyFilter("Otorhinolaryngology", "ENT"), true);
  });

  it('does not let "ENT" match Dentistry via substring', () => {
    assert.equal(matchesSpecialtyFilter("Dentistry", "ENT"), false);
    assert.equal(matchesSpecialtyFilter("Pediatric Dentistry", "ENT"), false);
  });

  it("still allows longer fuzzy specialty queries", () => {
    assert.equal(matchesSpecialtyFilter("Dermatology", "dermat"), true);
  });

  it("matches slug-decoded URL specialties (lowercase) to GeSY labels", () => {
    assert.equal(matchesSpecialtyFilter("Personal Doctor", "personal doctor"), true);
    assert.equal(matchesSpecialtyFilter("Paediatrics", "paediatrics"), true);
  });

  it("matches multi-specialty cards on either specialty", () => {
    assert.equal(
      matchesAnySpecialtyFilter(["Personal Doctor", "Paediatrics"], "Paediatrics"),
      true,
    );
    assert.equal(
      matchesAnySpecialtyFilter(["Personal Doctor", "Paediatrics"], "Cardiology"),
      false,
    );
  });
});
