import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchesFinderSpecialtyFilter } from "../../lib/doctor-specialty-public";
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

  it("matches Haematology cards when the category is Hematology", () => {
    assert.equal(matchesSpecialtyFilter("Haematology", "Hematology"), true);
    assert.equal(
      matchesAnySpecialtyFilter(["Haematology", "Microbiology"], "Hematology"),
      true,
    );
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

  it("matches a custom specialty from a slug-decoded finder URL", () => {
    assert.equal(matchesSpecialtyFilter("Sexology", "sexology"), true);
    assert.equal(
      matchesAnySpecialtyFilter(["Psychology", "Sexology"], "sexology"),
      true,
    );
    assert.equal(matchesAnySpecialtyFilter(["Psychology"], "sexology"), false);
  });
});

describe("matchesFinderSpecialtyFilter", () => {
  it("keeps a multi-specialty registered card on a custom specialty URL", () => {
    assert.equal(
      matchesFinderSpecialtyFilter({
        specialty: "Psychology",
        specialties: ["Psychology", "Sexology"],
        is_specialty_approved: true,
        activeSpecialty: "sexology",
        matchesSpecialty: matchesSpecialtyFilter,
      }),
      true,
    );
  });
});
