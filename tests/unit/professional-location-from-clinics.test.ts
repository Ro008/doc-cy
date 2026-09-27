import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clinicDistricts,
  locationHasClinic,
  primaryClinicLocationFields,
} from "../../lib/professional-clinic-locations";

/**
 * Where a professional practises comes from their clinics (professional_clinics ->
 * clinics), never from the copies on `professionals` (district, town, clinic_address,
 * latitude, longitude), which Point E removes. A professional created by the new
 * registration approval has no copies at all, so every reader derives them here.
 */

type Loc = {
  district: string | null;
  town?: string | null;
  clinic_address: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const paphos: Loc = {
  district: "Paphos",
  town: "Geroskipou",
  clinic_address: "1 Clinic Street, Geroskipou",
  latitude: 34.76,
  longitude: 32.45,
};

const limassol: Loc = {
  district: "Limassol",
  town: "Limassol",
  clinic_address: "2 Harbour Road, Limassol",
  latitude: 34.68,
  longitude: 33.04,
};

/** A clinic still being set up ("Add clinic"): no address or district yet. */
const settingUp: Loc = { district: null, town: null, clinic_address: null };

describe("primaryClinicLocationFields", () => {
  it("takes the primary (first) clinic's district, town, address and coordinates", () => {
    assert.deepEqual(primaryClinicLocationFields([paphos, limassol]), {
      district: "Paphos",
      town: "Geroskipou",
      clinic_address: "1 Clinic Street, Geroskipou",
      latitude: 34.76,
      longitude: 32.45,
    });
  });

  it("skips a clinic still being set up and uses the first one with a district", () => {
    assert.equal(primaryClinicLocationFields([settingUp, limassol]).district, "Limassol");
    assert.equal(
      primaryClinicLocationFields([settingUp, limassol]).clinic_address,
      "2 Harbour Road, Limassol",
    );
  });

  it("takes coordinates from the first clinic that has them", () => {
    const noPin: Loc = { ...paphos, latitude: null, longitude: null };
    const fields = primaryClinicLocationFields([noPin, limassol]);
    assert.equal(fields.district, "Paphos");
    assert.equal(fields.latitude, 34.68);
    assert.equal(fields.longitude, 33.04);
  });

  it("is all null without clinics, rather than falling back to anything else", () => {
    assert.deepEqual(primaryClinicLocationFields([]), {
      district: null,
      town: null,
      clinic_address: null,
      latitude: null,
      longitude: null,
    });
    assert.equal(primaryClinicLocationFields([settingUp]).district, null);
  });

  it("treats blank strings as missing", () => {
    const blank: Loc = { district: "  ", town: " ", clinic_address: "" };
    assert.equal(primaryClinicLocationFields([blank, limassol]).district, "Limassol");
  });
});

describe("locationHasClinic", () => {
  it("is true for a clinic with a district and an address, false for one still being set up", () => {
    assert.equal(locationHasClinic(paphos), true);
    assert.equal(locationHasClinic(settingUp), false);
    assert.equal(locationHasClinic({ ...paphos, district: " " }), false);
    // The bridge is "no address OR no district": either one missing means no clinic link.
    assert.equal(locationHasClinic({ ...paphos, clinic_address: null }), false);
  });
});

describe("clinicDistricts", () => {
  it("lists each district of a professional's clinics once, in clinic order", () => {
    assert.deepEqual(clinicDistricts([paphos, limassol, { ...paphos }]), ["Paphos", "Limassol"]);
  });

  it("ignores clinics without a district", () => {
    assert.deepEqual(clinicDistricts([settingUp, limassol]), ["Limassol"]);
    assert.deepEqual(clinicDistricts([]), []);
  });
});
