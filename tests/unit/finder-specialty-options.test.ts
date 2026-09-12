import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFinderSpecialtyOptions,
  resolveFinderSpecialtyDropdown,
} from "../../lib/finder-specialty-options";

const CANONICAL = [
  { slug: "hematology", label: "Hematology" },
  { slug: "biochemistry", label: "Biochemistry" },
  { slug: "paediatrics", label: "Paediatrics" },
];

describe("resolveFinderSpecialtyDropdown (no on-the-fly options)", () => {
  it("does not inject Haematology or Hematology as a second option from the active filter", () => {
    const withBritishUrl = resolveFinderSpecialtyDropdown(CANONICAL, "Haematology");
    const withAmericanUrl = resolveFinderSpecialtyDropdown(CANONICAL, "hematology");
    const withSeededDuplicate = resolveFinderSpecialtyDropdown(
      [
        { slug: "haematology", label: "Haematology" },
        { slug: "hematology", label: "Hematology" },
        { slug: "biochemistry", label: "Biochemistry" },
      ],
      "Hematology",
    );

    for (const resolved of [withBritishUrl, withAmericanUrl, withSeededDuplicate]) {
      const hematologyLabels = resolved.options.filter((o) => /h[ae]matology/i.test(o.label));
      assert.equal(hematologyLabels.length, 1);
      assert.equal(hematologyLabels[0]?.label, "Hematology");
      assert.equal(resolved.selectedSlug, "hematology");
      assert.equal(
        resolved.options.length,
        new Set(resolved.options.map((o) => o.slug)).size,
      );
    }
  });

  it("never grows the dropdown when the URL specialty is missing, combined, or a spelling variant", () => {
    const baseline = resolveFinderSpecialtyDropdown(CANONICAL, "").options;
    const cases = [
      "Haematology",
      "Pediatrics",
      "Quantum Healing",
      "Personal Doctor · Paediatrics",
      "personal-doctor-paediatrics",
    ];
    for (const active of cases) {
      const resolved = resolveFinderSpecialtyDropdown(CANONICAL, active);
      assert.deepEqual(
        resolved.options.map((o) => o.label),
        baseline.map((o) => o.label),
        `must not add a ghost option for ${active}`,
      );
    }
  });

  it("maps a British/legacy URL onto the existing canonical option instead of adding one", () => {
    const resolved = resolveFinderSpecialtyDropdown(CANONICAL, "Pediatrics");
    assert.equal(resolved.options.some((o) => o.label === "Pediatrics"), false);
    assert.equal(resolved.selectedSlug, "paediatrics");
  });

  it("does not select All/empty when the canonical option exists", () => {
    const resolved = resolveFinderSpecialtyDropdown(CANONICAL, "HAEMATOLOGY");
    assert.equal(resolved.selectedSlug, "hematology");
  });

  it("leaves the select unselected for unknown specialties instead of inventing a row", () => {
    // Ghost URL labels stay out. Approved custom specialties still belong in the
    // dropdown when they come from registered specialties[] (see Sexology case).
    const resolved = resolveFinderSpecialtyDropdown(CANONICAL, "Quantum Healing");
    assert.equal(resolved.selectedSlug, "");
    assert.equal(resolved.options.some((o) => /quantum/i.test(o.label)), false);
  });
});

describe("buildFinderSpecialtyOptions", () => {
  it("collapses Haematology and Hematology from directory rows into one Hematology option", () => {
    const options = buildFinderSpecialtyOptions(
      [{ specialties: ["Haematology", "Hematology", "Biochemistry"] }],
      [{ specialty: "HAEMATOLOGY" }],
    );
    assert.equal(options.filter((o) => /h[ae]matology/i.test(o.label)).length, 1);
    assert.equal(options.find((o) => /h[ae]matology/i.test(o.label))?.label, "Hematology");
  });

  it("adds approved custom specialties from the registered specialties array", () => {
    const options = buildFinderSpecialtyOptions(
      [],
      [{ specialty: "Psychology", specialties: ["Psychology", "Sexology"] }],
    );
    assert.equal(options.some((o) => o.label === "Psychology"), true);
    assert.equal(options.some((o) => o.label === "Sexology" && o.slug === "sexology"), true);

    const resolved = resolveFinderSpecialtyDropdown(options, "sexology");
    assert.equal(resolved.selectedSlug, "sexology");
    assert.equal(resolved.options.some((o) => o.label === "Sexology"), true);
  });
});
