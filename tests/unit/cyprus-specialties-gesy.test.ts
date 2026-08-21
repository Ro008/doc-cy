import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CYPRUS_MASTER_SPECIALTIES,
  isCurrentRegistrationSpecialty,
  isMasterSpecialty,
} from "../../lib/cyprus-specialties";
import {
  GESY_MANUAL_SPECIALTIES,
  parseGesySpecialtyCell,
} from "../../lib/gesy-specialties";
import {
  harmonizeFinderSpecialtyLabel,
  harmonizeFinderSpecialtyList,
} from "../../lib/finder-specialty-harmonize";
import { finderSpecialtyDbMatchValues } from "../../lib/finder-results-paging";
import { matchesSpecialtyFilter } from "../../lib/finder-specialty-filter";
import { buildFinderSpecialtyOptions } from "../../lib/finder-specialty-options";

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

describe("Hematology vs Haematology (one category)", () => {
  it("keeps Hematology as the only canonical GeSY/registration label", () => {
    assert.equal(GESY_MANUAL_SPECIALTIES.includes("Hematology"), true);
    assert.equal(GESY_MANUAL_SPECIALTIES.includes("Haematology" as never), false);
    assert.equal(CYPRUS_MASTER_SPECIALTIES.includes("Hematology"), true);
    assert.equal(CYPRUS_MASTER_SPECIALTIES.includes("Haematology"), false);
    assert.equal(isCurrentRegistrationSpecialty("Hematology"), true);
    assert.equal(isCurrentRegistrationSpecialty("Haematology"), false);
    assert.equal(isMasterSpecialty("Haematology"), true);
  });

  it("harmonizes British spelling and GeSY ALL CAPS to Hematology", () => {
    assert.equal(harmonizeFinderSpecialtyLabel("Haematology"), "Hematology");
    assert.equal(harmonizeFinderSpecialtyLabel("HAEMATOLOGY"), "Hematology");
    assert.equal(harmonizeFinderSpecialtyLabel("HEMATOLOGY"), "Hematology");
    assert.equal(harmonizeFinderSpecialtyLabel("hematology"), "Hematology");
  });

  it("collapses both spellings into one pill and one dropdown option", () => {
    assert.deepEqual(
      harmonizeFinderSpecialtyList(["HAEMATOLOGY", "MICROBIOLOGY", "HEMATOLOGY"]),
      ["Hematology", "Microbiology"],
    );
    const options = buildFinderSpecialtyOptions(
      [{ specialties: ["Haematology", "Hematology", "Biochemistry"] }],
      [],
    );
    assert.equal(options.filter((o) => /h[ae]matology/i.test(o.label)).length, 1);
    assert.equal(options.find((o) => /h[ae]matology/i.test(o.label))?.label, "Hematology");
  });

  it("merges both GeSY codes when parsing an Excel specialty cell", () => {
    assert.deepEqual(
      parseGesySpecialtyCell("HAEMATOLOGY; MICROBIOLOGY; BIOCHEMISTRY; IMMUNOLOGY; HEMATOLOGY"),
      ["Hematology", "MICROBIOLOGY", "BIOCHEMISTRY", "IMMUNOLOGY"],
    );
  });

  it("matches either spelling in finder filters and SQL variants", () => {
    assert.equal(matchesSpecialtyFilter("Haematology", "Hematology"), true);
    assert.equal(matchesSpecialtyFilter("Hematology", "Haematology"), true);
    assert.ok(finderSpecialtyDbMatchValues("Hematology").includes("Haematology"));
    assert.ok(finderSpecialtyDbMatchValues("Haematology").includes("Hematology"));
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
