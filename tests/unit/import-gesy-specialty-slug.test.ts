import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { specialtyToSlug } from "../../lib/finder-seo";
// The GeSY import is plain .mjs and keeps its own copy of the slug rule.
import { specialtySlug } from "../../scripts/import-gesy-directory-batch.mjs";

describe("GeSY import specialty slug", () => {
  it("matches specialtyToSlug, so import labels resolve to catalogue rows", () => {
    for (const label of [
      "Obstetrics - Gynaecology",
      "Thoracic Surgery / Cardio Surgery",
      "Accident & Emergency Medicine",
      "Oral And Maxillo-Facial Surgery",
      "MICROBIOLOGY",
      "  Personal   Doctor ",
      "Café Médecine",
      "Dermato-Venereology",
    ]) {
      assert.equal(specialtySlug(label), specialtyToSlug(label), label);
    }
  });
});
