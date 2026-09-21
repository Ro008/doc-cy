import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { specialtyToSlug } from "../../lib/finder-seo";
import {
  canonicalSpecialtySlug,
  catalogueIdsForFinderSlug,
  findCatalogueSpecialty,
  finderSpecialtyOptionsFromCatalogue,
  hasSpecialtySlug,
  specialtiesFromLinks,
  type CatalogueSpecialty,
} from "../../lib/specialty-catalogue";

/**
 * The 63 specialties in Production's catalogue (2026-09-21). Finder URLs are built
 * from these slugs and are indexed, so `specialtyToSlug` must keep producing them.
 * The database computes the same slugs with `public.specialty_slug()`.
 */
const PRODUCTION_CATALOGUE: Array<[name: string, slug: string]> = [
  ["Accident & Emergency Medicine", "accident-emergency-medicine"],
  ["Allergology", "allergology"],
  ["Anesthesiology", "anesthesiology"],
  ["Biochemistry", "biochemistry"],
  ["Cardiology", "cardiology"],
  ["Child & Adolescent Psychiatry", "child-adolescent-psychiatry"],
  ["Clinical Dietitian", "clinical-dietitian"],
  ["Clinical Psychologist", "clinical-psychologist"],
  ["Cytology", "cytology"],
  ["Dentist", "dentist"],
  ["Dentoalveolar Surgery", "dentoalveolar-surgery"],
  ["Dermato-Venereology", "dermato-venereology"],
  ["Diagnostic Radiology", "diagnostic-radiology"],
  ["Endocrinology", "endocrinology"],
  ["Gastroenterology", "gastroenterology"],
  ["General Nurse", "general-nurse"],
  ["General Surgery", "general-surgery"],
  ["Geriatrics", "geriatrics"],
  ["Hematology", "hematology"],
  ["Immunology", "immunology"],
  ["Infectious Diseases", "infectious-diseases"],
  ["Intensive Care", "intensive-care"],
  ["Internal Medicine", "internal-medicine"],
  ["Medical Genetic", "medical-genetic"],
  ["Medical Oncology", "medical-oncology"],
  ["Mental Health Nurse", "mental-health-nurse"],
  ["Microbiology", "microbiology"],
  ["Midwife", "midwife"],
  ["Neonatology", "neonatology"],
  ["Neurological Surgery", "neurological-surgery"],
  ["Neurology", "neurology"],
  ["Nuclear Medicine", "nuclear-medicine"],
  ["Obstetrics - Gynaecology", "obstetrics-gynaecology"],
  ["Occupational Therapist", "occupational-therapist"],
  ["Ophthalmology", "ophthalmology"],
  ["Oral And Maxillo-Facial Surgery", "oral-and-maxillo-facial-surgery"],
  ["Oral Surgery", "oral-surgery"],
  ["Orthodontics", "orthodontics"],
  ["Orthopaedics", "orthopaedics"],
  ["Otorhinolaryngology", "otorhinolaryngology"],
  ["Paediatric Cardiology", "paediatric-cardiology"],
  ["Paediatric Neurology", "paediatric-neurology"],
  ["Paediatric Surgery", "paediatric-surgery"],
  ["Paediatrics", "paediatrics"],
  ["Palliative Care Services", "palliative-care-services"],
  ["Pathological Anatomy", "pathological-anatomy"],
  ["Personal Doctor", "personal-doctor"],
  ["Physical Medicine And Rehabilitation", "physical-medicine-and-rehabilitation"],
  ["Physiotherapist", "physiotherapist"],
  ["Plastic Surgery", "plastic-surgery"],
  ["Podiatrist", "podiatrist"],
  ["Psychiatry", "psychiatry"],
  ["Psychology", "psychology"],
  ["Radiation Oncology", "radiation-oncology"],
  ["Rehabilitation Services", "rehabilitation-services"],
  ["Renal Diseases", "renal-diseases"],
  ["Respiratory Medicine", "respiratory-medicine"],
  ["Rheumatology", "rheumatology"],
  ["Sexology", "sexology"],
  ["Speech Therapist", "speech-therapist"],
  ["Thoracic Surgery / Cardio Surgery", "thoracic-surgery-cardio-surgery"],
  ["Urology", "urology"],
  ["Vascular Surgery", "vascular-surgery"],
];

const CATALOGUE: CatalogueSpecialty[] = PRODUCTION_CATALOGUE.map(([name, slug], i) => ({
  id: `id-${i}`,
  name,
  slug,
}));

function resolved(raw: string) {
  const hit = findCatalogueSpecialty(CATALOGUE, raw);
  return hit ? { name: hit.specialty.name, isAlias: hit.isAlias } : null;
}

describe("catalogue slugs (indexed finder URLs)", () => {
  it("specialtyToSlug reproduces every Production catalogue slug", () => {
    for (const [name, slug] of PRODUCTION_CATALOGUE) {
      assert.equal(specialtyToSlug(name), slug, name);
    }
  });

  it("every Production specialty is its own canonical slug (none folded away)", () => {
    for (const [name, slug] of PRODUCTION_CATALOGUE) {
      assert.equal(canonicalSpecialtySlug(name), slug, name);
    }
  });
});

describe("findCatalogueSpecialty", () => {
  it("resolves a URL slug, a label and any casing directly", () => {
    assert.deepEqual(resolved("paediatrics"), { name: "Paediatrics", isAlias: false });
    assert.deepEqual(resolved("Obstetrics - Gynaecology"), {
      name: "Obstetrics - Gynaecology",
      isAlias: false,
    });
    assert.deepEqual(resolved("obstetrics-gynaecology"), {
      name: "Obstetrics - Gynaecology",
      isAlias: false,
    });
  });

  it("is case-insensitive for custom labels (the old overlaps() bug)", () => {
    assert.deepEqual(resolved("sexology"), { name: "Sexology", isAlias: false });
    assert.deepEqual(resolved("SEXOLOGY"), { name: "Sexology", isAlias: false });
  });

  it("resolves legacy spellings through aliases, flagged for a redirect", () => {
    assert.deepEqual(resolved("haematology"), { name: "Hematology", isAlias: true });
    assert.deepEqual(resolved("dentistry"), { name: "Dentist", isAlias: true });
    assert.deepEqual(resolved("pediatrics"), { name: "Paediatrics", isAlias: true });
    assert.deepEqual(resolved("gynecology"), {
      name: "Obstetrics - Gynaecology",
      isAlias: true,
    });
    assert.deepEqual(resolved("ent"), { name: "Otorhinolaryngology", isAlias: true });
  });

  it("prefers a direct catalogue row over an alias", () => {
    const withLegacyRow = [...CATALOGUE, { id: "legacy", name: "Dentistry", slug: "dentistry" }];
    const hit = findCatalogueSpecialty(withLegacyRow, "dentistry");
    assert.equal(hit?.specialty.name, "Dentistry");
    assert.equal(hit?.isAlias, false);
  });

  it("keeps Psychology and Clinical Psychologist apart", () => {
    assert.deepEqual(resolved("psychology"), { name: "Psychology", isAlias: false });
    assert.deepEqual(resolved("clinical-psychologist"), {
      name: "Clinical Psychologist",
      isAlias: false,
    });
  });

  it("returns null for empty, 'all' and unknown values", () => {
    assert.equal(resolved(""), null);
    assert.equal(resolved("all"), null);
    assert.equal(resolved("astrology"), null);
  });
});

describe("specialtiesFromLinks", () => {
  it("keeps approved labels only, unique by slug, alphabetical", () => {
    const labels = specialtiesFromLinks([
      { is_approved: true, specialties: { name: "Personal Doctor", slug: "personal-doctor" } },
      { is_approved: true, specialties: { name: "Paediatrics", slug: "paediatrics" } },
      { is_approved: false, specialties: null },
      { is_approved: false, specialties: { name: "Cardiology", slug: "cardiology" } },
      { is_approved: true, specialties: { name: "Paediatrics", slug: "paediatrics" } },
    ]);
    assert.deepEqual(
      labels.map((l) => l.name),
      ["Paediatrics", "Personal Doctor"],
    );
  });

  it("tolerates a missing embed", () => {
    assert.deepEqual(specialtiesFromLinks(undefined), []);
    assert.deepEqual(specialtiesFromLinks(null), []);
  });
});

describe("hasSpecialtySlug", () => {
  const labels = [{ name: "Paediatrics" }, { name: "Personal Doctor" }];
  it("matches any of a multi-specialty professional's labels", () => {
    assert.equal(hasSpecialtySlug(labels, "personal-doctor"), true);
    assert.equal(hasSpecialtySlug(labels, "cardiology"), false);
  });
  it("matches a legacy spelling under its canonical slug", () => {
    assert.equal(hasSpecialtySlug([{ name: "Dentistry" }], "dentist"), true);
    assert.equal(hasSpecialtySlug([{ name: "Dermatology" }], "dermato-venereology"), true);
  });
  it("passes everything when no specialty is active", () => {
    assert.equal(hasSpecialtySlug(labels, ""), true);
    assert.equal(hasSpecialtySlug([], null), true);
  });
});

describe("catalogueIdsForFinderSlug", () => {
  const withLegacy: CatalogueSpecialty[] = [
    ...CATALOGUE,
    { id: "legacy-dentistry", name: "Dentistry", slug: "dentistry" },
  ];
  it("includes legacy-spelling rows under the canonical specialty", () => {
    const ids = catalogueIdsForFinderSlug(withLegacy, "dentist");
    assert.equal(ids.length, 2);
    assert.ok(ids.includes("legacy-dentistry"));
  });
  it("returns only the row itself otherwise, and nothing for unknown slugs", () => {
    assert.equal(catalogueIdsForFinderSlug(withLegacy, "urology").length, 1);
    assert.deepEqual(catalogueIdsForFinderSlug(withLegacy, "astrology"), []);
  });
});

describe("finderSpecialtyOptionsFromCatalogue", () => {
  it("lists only specialties with a visible professional, alphabetically", () => {
    const byName = new Map(CATALOGUE.map((row) => [row.name, row.id]));
    const available = new Set([
      byName.get("Urology")!,
      byName.get("Cardiology")!,
      byName.get("Sexology")!,
    ]);
    assert.deepEqual(finderSpecialtyOptionsFromCatalogue(CATALOGUE, available), [
      { slug: "cardiology", label: "Cardiology" },
      { slug: "sexology", label: "Sexology" },
      { slug: "urology", label: "Urology" },
    ]);
  });

  it("shows a legacy row's availability under its canonical option only", () => {
    const catalogue = [
      { id: "d", name: "Dentist", slug: "dentist" },
      { id: "dy", name: "Dentistry", slug: "dentistry" },
    ];
    assert.deepEqual(finderSpecialtyOptionsFromCatalogue(catalogue, new Set(["dy"])), [
      { slug: "dentist", label: "Dentist" },
    ]);
  });

  it("drops generic labels even when available", () => {
    const catalogue = [
      { id: "p", name: "Pharmacy", slug: "pharmacy" },
      { id: "u", name: "Urology", slug: "urology" },
    ];
    assert.deepEqual(finderSpecialtyOptionsFromCatalogue(catalogue, new Set(["p", "u"])), [
      { slug: "urology", label: "Urology" },
    ]);
  });
});
