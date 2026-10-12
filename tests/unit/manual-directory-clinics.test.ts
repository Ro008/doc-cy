import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildManualDirectoryClinicRefs,
  formatClinicCountLabel,
  formatMoreClinicsLabel,
  professionalMatchesDistrictFilter,
} from "../../lib/manual-directory-clinics";

describe("buildManualDirectoryClinicRefs", () => {
  it("returns a single clinic", () => {
    const refs = buildManualDirectoryClinicRefs([
      {
        clinic_id: "c1",
        sort_order: 0,
        clinics: {
          name: "Alpha Clinic",
          slug: "alpha-clinic",
          address: "Street 1",
          address_maps_link: "https://maps.example/a",
          district: "Nicosia",
          is_archived: false,
        },
      },
    ]);
    assert.equal(refs.length, 1);
    assert.deepEqual(refs[0], {
      id: "c1",
      name: "Alpha Clinic",
      slug: "alpha-clinic",
      address: "Street 1",
      addressMapsLink: "https://maps.example/a",
      district: "Nicosia",
      hasPhone: false,
    });
  });

  it("keeps the clinic order (sort_order) and both clinics for multi-clinic pros", () => {
    const refs = buildManualDirectoryClinicRefs([
      {
        clinic_id: "c2",
        sort_order: 1,
        clinics: {
          name: "Second Place",
          slug: "second-place",
          address: "B street",
          address_maps_link: "https://maps.example/b",
          district: "Larnaca",
        },
      },
      {
        clinic_id: "c1",
        sort_order: 0,
        clinics: {
          name: "Primary Place",
          slug: "primary-place",
          address: "A street",
          address_maps_link: "https://maps.example/a",
          district: "Nicosia",
        },
      },
    ]);
    assert.equal(refs.length, 2);
    assert.equal(refs[0]?.slug, "primary-place");
    assert.equal(refs[1]?.slug, "second-place");
  });

  it("skips archived and incomplete clinics, dedupes by id", () => {
    const refs = buildManualDirectoryClinicRefs([
      {
        clinic_id: "c1",
        sort_order: 0,
        clinics: {
          name: "Keep",
          slug: "keep",
          is_archived: false,
        },
      },
      {
        clinic_id: "c-archived",
        sort_order: 1,
        clinics: {
          name: "Gone",
          slug: "gone",
          is_archived: true,
        },
      },
      {
        clinic_id: "c-bad",
        sort_order: 1,
        clinics: { name: "", slug: "no-name" },
      },
      {
        clinic_id: "c1",
        sort_order: 1,
        clinics: {
          name: "Duplicate id",
          slug: "keep-dup",
        },
      },
    ]);
    assert.equal(refs.length, 1);
    assert.equal(refs[0]?.slug, "keep");
  });

  it("keeps the given order when two clinics share a place", () => {
    const refs = buildManualDirectoryClinicRefs([
      {
        clinic_id: "c1",
        sort_order: 1,
        clinics: { name: "One", slug: "one" },
      },
      {
        clinic_id: "c2",
        sort_order: 1,
        clinics: { name: "Two", slug: "two" },
      },
    ]);
    assert.equal(refs.length, 2);
    assert.deepEqual(refs.map((ref) => ref.slug), ["one", "two"]);
    assert.equal("isPrimary" in refs[0]!, false);
  });

  it("marks hasPhone from clinic phone without exposing the number", () => {
    const refs = buildManualDirectoryClinicRefs([
      {
        clinic_id: "c1",
        sort_order: 0,
        clinics: {
          id: "c1",
          name: "Alpha Clinic",
          slug: "alpha-clinic",
          phone: "+357 99 123456",
        },
      },
    ]);
    assert.equal(refs[0]?.id, "c1");
    assert.equal(refs[0]?.hasPhone, true);
    assert.equal("phone" in (refs[0] ?? {}), false);
  });
});

describe("multi-clinic UX labels", () => {
  it("formats quiet count and more-clinics labels", () => {
    assert.equal(formatClinicCountLabel(2), "2 clinics");
    assert.equal(formatClinicCountLabel(1), "1 clinic");
    assert.equal(formatMoreClinicsLabel(1), "+1 more clinic");
    assert.equal(formatMoreClinicsLabel(2), "+2 more clinics");
  });
});

describe("professionalMatchesDistrictFilter", () => {
  it("matches primary district", () => {
    assert.equal(
      professionalMatchesDistrictFilter({
        district: "Larnaca",
        clinicDistricts: ["Nicosia"],
        activeDistrict: "Larnaca",
      }),
      true,
    );
  });

  it("matches when only a linked clinic is in the filtered district", () => {
    assert.equal(
      professionalMatchesDistrictFilter({
        district: "Larnaca",
        clinicDistricts: ["Nicosia", "Larnaca"],
        activeDistrict: "Nicosia",
      }),
      true,
    );
  });

  it("rejects when neither primary nor clinics match", () => {
    assert.equal(
      professionalMatchesDistrictFilter({
        district: "Larnaca",
        clinicDistricts: ["Larnaca"],
        activeDistrict: "Paphos",
      }),
      false,
    );
  });
});
