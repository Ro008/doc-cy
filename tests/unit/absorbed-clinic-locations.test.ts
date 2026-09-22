import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { locationsToAddForAbsorbedClinics } from "@/lib/absorbed-clinic-locations";

const pegeia = {
  id: "clinic-pegeia",
  address: "Avenue Michalaki Kyprianou 24, Pegeia, 8560, Paphos",
  town: "Pegeia",
  district: "Paphos",
  latitude: 34.8829,
  longitude: 32.3742,
  clinic_place_id: null,
};

const geroskipou = {
  id: "clinic-geroskipou",
  address: "B6 39, Geroskipou, Pafos 8035, Cyprus",
  town: "Geroskipou",
  district: "Paphos",
  latitude: 34.7663954,
  longitude: 32.4444033,
  clinic_place_id: "place-abc",
};

/**
 * Verify absorbs the listing a professional claimed, which moves that listing's clinic
 * onto them. The card renders `doctor_locations`, so a clinic with no matching location
 * row is a workplace that was public on the listing and disappears the moment we verify
 * them. The professional told us they work there; we keep it.
 */
describe("locationsToAddForAbsorbedClinics", () => {
  it("adds the absorbed clinic the professional has no location for", () => {
    const got = locationsToAddForAbsorbedClinics({
      clinics: [pegeia],
      existingLocations: [{ clinic_address: "B6 39, Geroskipou, Pafos 8035, Cyprus", sort_order: 0 }],
    });
    assert.equal(got.length, 1);
    assert.deepEqual(got[0], {
      clinic_address: pegeia.address,
      town: "Pegeia",
      district: "Paphos",
      latitude: 34.8829,
      longitude: 32.3742,
      clinic_place_id: null,
      is_primary: false,
      sort_order: 1,
      pause_online_bookings: true,
    });
  });

  it("never touches the address they registered themselves", () => {
    const got = locationsToAddForAbsorbedClinics({
      clinics: [geroskipou],
      existingLocations: [{ clinic_address: "B6 39, Geroskipou, Pafos 8035, Cyprus", sort_order: 0 }],
    });
    assert.deepEqual(got, []);
  });

  it("matches loosely enough that punctuation or a trailing country is not a new clinic", () => {
    const got = locationsToAddForAbsorbedClinics({
      clinics: [pegeia],
      existingLocations: [
        { clinic_address: "avenue michalaki kyprianou 24 — pegeia, 8560, paphos, Cyprus", sort_order: 0 },
      ],
    });
    assert.deepEqual(got, []);
  });

  it("never marks an added location primary, and never opens it for bookings", () => {
    const [added] = locationsToAddForAbsorbedClinics({
      clinics: [pegeia],
      existingLocations: [{ clinic_address: "Somewhere else 1, Paphos", sort_order: 3 }],
    });
    assert.equal(added.is_primary, false);
    assert.equal(added.pause_online_bookings, true);
    assert.equal(added.sort_order, 4);
  });

  it("skips clinics with no usable address", () => {
    const got = locationsToAddForAbsorbedClinics({
      clinics: [{ ...pegeia, address: "   " }],
      existingLocations: [],
    });
    assert.deepEqual(got, []);
  });

  it("does not add the same address twice within one absorb", () => {
    const got = locationsToAddForAbsorbedClinics({
      clinics: [pegeia, { ...pegeia, id: "clinic-duplicate" }],
      existingLocations: [],
    });
    assert.equal(got.length, 1);
  });

  it("respects the per-professional location cap", () => {
    const existing = Array.from({ length: 5 }, (_, i) => ({
      clinic_address: `Street ${i}, Paphos`,
      sort_order: i,
    }));
    const got = locationsToAddForAbsorbedClinics({ clinics: [pegeia], existingLocations: existing });
    assert.deepEqual(got, []);
  });

  it("adds several clinics at once, numbering them after the existing ones", () => {
    const got = locationsToAddForAbsorbedClinics({
      clinics: [pegeia, geroskipou],
      existingLocations: [{ clinic_address: "Street 0, Paphos", sort_order: 0 }],
    });
    assert.deepEqual(
      got.map((l) => [l.clinic_address, l.sort_order]),
      [
        [pegeia.address, 1],
        [geroskipou.address, 2],
      ],
    );
  });
});
