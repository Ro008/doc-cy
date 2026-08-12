import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CYPRUS_MASTER_SPECIALTIES,
  isCurrentRegistrationSpecialty,
  isMasterSpecialty,
} from "../../lib/cyprus-specialties";
import { harmonizeFinderSpecialtyLabel } from "../../lib/finder-specialty-harmonize";
import { finderSpecialtyDbMatchValues } from "../../lib/finder-results-paging";
import { matchesSpecialtyFilter } from "../../lib/finder-specialty-filter";

describe("registration specialties (GeSY + Psychology)", () => {
  it("offers GeSY labels and Psychology, not Pharmacy/Laboratory", () => {
    assert.ok(CYPRUS_MASTER_SPECIALTIES.includes("Personal Doctor"));
    assert.ok(CYPRUS_MASTER_SPECIALTIES.includes("Clinical Psychologist"));
    assert.ok(CYPRUS_MASTER_SPECIALTIES.includes("Psychology"));
    assert.ok(CYPRUS_MASTER_SPECIALTIES.includes("Dentist"));
    assert.equal(CYPRUS_MASTER_SPECIALTIES.includes("Pharmacy"), false);
    assert.equal(CYPRUS_MASTER_SPECIALTIES.includes("Laboratory"), false);
    assert.equal(CYPRUS_MASTER_SPECIALTIES.includes("Dentistry"), false);
  });

  it("accepts legacy labels as master for grandfathered doctors", () => {
    assert.equal(isMasterSpecialty("Psychology"), true);
    assert.equal(isMasterSpecialty("Dentistry"), true);
    assert.equal(isCurrentRegistrationSpecialty("Dentistry"), false);
    assert.equal(isCurrentRegistrationSpecialty("Dentist"), true);
  });
});

describe("Psychology vs Clinical Psychologist (no merge)", () => {
  it("keeps Psychology distinct from Clinical Psychologist in harmonize", () => {
    assert.equal(harmonizeFinderSpecialtyLabel("Psychology"), "Psychology");
    assert.equal(
      harmonizeFinderSpecialtyLabel("Clinical Psychologist"),
      "Clinical Psychologist",
    );
  });

  it("does not match Psychology filter to Clinical Psychologist cards", () => {
    assert.equal(matchesSpecialtyFilter("Clinical Psychologist", "Psychology"), false);
    assert.equal(matchesSpecialtyFilter("Psychology", "Clinical Psychologist"), false);
    assert.equal(matchesSpecialtyFilter("Psychology", "Psychology"), true);
  });

  it("keeps SQL variants separate", () => {
    assert.deepEqual(finderSpecialtyDbMatchValues("Clinical Psychologist"), [
      "Clinical Psychologist",
    ]);
    assert.ok(finderSpecialtyDbMatchValues("Psychology").includes("Psychology"));
    assert.equal(
      finderSpecialtyDbMatchValues("Clinical Psychologist").includes("Psychology"),
      false,
    );
  });
});
