import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogueNamesForForms } from "../../lib/specialty-catalogue";
import {
  isCatalogueSpecialty,
  matchCatalogueSpecialty,
} from "../../lib/specialty-options";
import { validateSpecialtySubmission } from "../../lib/specialty-submission";
import {
  GESY_MANUAL_SPECIALTIES,
  parseGesySpecialtyCell,
} from "../../lib/gesy-specialties";
import {
  harmonizeFinderSpecialtyLabel,
  harmonizeFinderSpecialtyList,
} from "../../lib/finder-specialty-harmonize";
import { matchesSpecialtyFilter } from "../../lib/finder-specialty-filter";
import { buildFinderSpecialtyOptions } from "../../lib/finder-specialty-options";

/** Shaped like the `specialties` table, including rows Testing still carries. */
const CATALOGUE_ROWS = [
  { id: "1", name: "Personal Doctor", slug: "personal-doctor" },
  { id: "2", name: "Clinical Psychologist", slug: "clinical-psychologist" },
  { id: "3", name: "Psychology", slug: "psychology" },
  { id: "4", name: "Dentist", slug: "dentist" },
  { id: "5", name: "Dentistry", slug: "dentistry" },
  { id: "6", name: "Pharmacy", slug: "pharmacy" },
  { id: "7", name: "Hematology", slug: "hematology" },
  { id: "8", name: "Sexology", slug: "sexology" },
  { id: "9", name: "Paediatrics", slug: "paediatrics" },
];
const FORM_CATALOGUE = catalogueNamesForForms(CATALOGUE_ROWS);

describe("form specialties come from the catalogue", () => {
  it("offers canonical catalogue names, Psychology and approved custom labels, alphabetically", () => {
    assert.deepEqual(FORM_CATALOGUE, [
      "Clinical Psychologist",
      "Dentist",
      "Hematology",
      "Paediatrics",
      "Personal Doctor",
      "Psychology",
      "Sexology",
    ]);
  });

  it("drops legacy spellings and the generic Pharmacy row", () => {
    assert.equal(FORM_CATALOGUE.includes("Dentistry"), false);
    assert.equal(FORM_CATALOGUE.includes("Pharmacy"), false);
  });

  it("no longer grandfathers legacy labels", () => {
    assert.equal(isCatalogueSpecialty(FORM_CATALOGUE, "Psychology"), true);
    assert.equal(isCatalogueSpecialty(FORM_CATALOGUE, "Dentist"), true);
    assert.equal(isCatalogueSpecialty(FORM_CATALOGUE, "Dentistry"), false);
    assert.equal(isCatalogueSpecialty(FORM_CATALOGUE, "Pediatrics"), false);
    assert.deepEqual(matchCatalogueSpecialty(FORM_CATALOGUE, "Pediatrics"), {
      name: "Paediatrics",
      viaAlias: true,
    });
  });

  it("matches casing variants to the catalogue name", () => {
    assert.deepEqual(matchCatalogueSpecialty(FORM_CATALOGUE, "sexology"), {
      name: "Sexology",
      viaAlias: false,
    });
  });

  it("validates picks and Other text against the catalogue", () => {
    assert.deepEqual(validateSpecialtySubmission("sexology", true, FORM_CATALOGUE), {
      ok: true,
      specialty: "Sexology",
      is_specialty_approved: true,
    });
    assert.equal(validateSpecialtySubmission("Dentistry", true, FORM_CATALOGUE).ok, false);
    // Other text that names a catalogue specialty (even by a legacy spelling) is refused.
    assert.equal(validateSpecialtySubmission("Sexology", false, FORM_CATALOGUE).ok, false);
    assert.equal(validateSpecialtySubmission("Pediatrics", false, FORM_CATALOGUE).ok, false);
    assert.deepEqual(validateSpecialtySubmission("Reiki", false, FORM_CATALOGUE), {
      ok: true,
      specialty: "Reiki",
      is_specialty_approved: false,
    });
  });
});

describe("Hematology vs Haematology (one category)", () => {
  it("keeps Hematology as the only canonical GeSY/registration label", () => {
    assert.equal(GESY_MANUAL_SPECIALTIES.includes("Hematology"), true);
    assert.equal(GESY_MANUAL_SPECIALTIES.includes("Haematology" as never), false);
    assert.equal(isCatalogueSpecialty(FORM_CATALOGUE, "Hematology"), true);
    assert.equal(isCatalogueSpecialty(FORM_CATALOGUE, "Haematology"), false);
    assert.deepEqual(matchCatalogueSpecialty(FORM_CATALOGUE, "Haematology"), {
      name: "Hematology",
      viaAlias: true,
    });
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

  it("matches either spelling in finder filters", () => {
    assert.equal(matchesSpecialtyFilter("Haematology", "Hematology"), true);
    assert.equal(matchesSpecialtyFilter("Hematology", "Haematology"), true);
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
});
