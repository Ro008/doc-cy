import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterAvailableMasterSpecialties,
  hasDuplicateSpecialtyLabels,
} from "@/lib/specialty-options";

describe("filterAvailableMasterSpecialties", () => {
  const masters = ["Allergology", "Immunology", "Dentistry"];

  it("hides specialties already selected on other rows", () => {
    assert.deepEqual(
      filterAvailableMasterSpecialties(masters, ["Allergology"]),
      ["Immunology", "Dentistry"],
    );
  });

  it("keeps the current row selection even when excluded", () => {
    assert.deepEqual(
      filterAvailableMasterSpecialties(masters, ["Allergology", "Dentistry"], "Allergology"),
      ["Allergology", "Immunology"],
    );
  });

  it("matches exclusions case-insensitively", () => {
    assert.deepEqual(
      filterAvailableMasterSpecialties(masters, ["allergology"]),
      ["Immunology", "Dentistry"],
    );
  });
});

describe("hasDuplicateSpecialtyLabels", () => {
  it("detects case-insensitive duplicates and ignores blanks", () => {
    assert.equal(hasDuplicateSpecialtyLabels(["Allergology", "Immunology"]), false);
    assert.equal(hasDuplicateSpecialtyLabels(["Allergology", "allergology"]), true);
    assert.equal(hasDuplicateSpecialtyLabels(["", "Dentistry", "  "]), false);
  });
});
