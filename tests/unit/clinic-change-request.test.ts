import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateClinicChangeRequest,
  validateNewClinic,
  type ClinicPick,
} from "../../lib/clinic-change-request";

const limassolPin = {
  address: "Agiou Athanasiou 12, 4102 Limassol",
  latitude: 34.69,
  longitude: 33.05,
  placeId: "place-limassol",
  district: "Limassol" as const,
  town: "Limassol",
};

const paphosPin = {
  address: "Kennedy Ave 4, 8047 Paphos",
  latitude: 34.77,
  longitude: 32.42,
  placeId: "place-paphos",
  district: "Paphos" as const,
  town: "Paphos",
};

const noLocation = {
  address: "",
  latitude: null,
  longitude: null,
  placeId: null,
  district: null,
  town: null,
};

const current = {
  name: "Limassol Skin Clinic",
  address: limassolPin.address,
  phone: "25123456",
};

function pick(patch: Partial<ClinicPick> = {}): ClinicPick {
  return { clinicId: null, name: current.name, phone: current.phone, location: limassolPin, ...patch };
}

describe("validateClinicChangeRequest", () => {
  it("sends only the fields that changed", () => {
    assert.deepEqual(validateClinicChangeRequest({ current, requested: pick({ name: "Skin Clinic" }) }), {
      ok: true,
      changes: { name: "Skin Clinic" },
    });
  });

  it("sends a new address with its pin", () => {
    assert.deepEqual(validateClinicChangeRequest({ current, requested: pick({ location: paphosPin }) }), {
      ok: true,
      changes: {
        address: paphosPin.address,
        location: {
          latitude: 34.77,
          longitude: 32.42,
          placeId: "place-paphos",
          district: "Paphos",
          town: "Paphos",
        },
      },
    });
  });

  it("needs the new address picked on the map", () => {
    const result = validateClinicChangeRequest({
      current,
      requested: pick({ location: { ...noLocation, address: "Somewhere 1" } }),
    });
    assert.deepEqual(result, {
      ok: false,
      field: "location",
      message: "Pick the address from the suggestions or drop a pin.",
    });
  });

  it("moves to a DocCy clinic as-is (its name, address and phone)", () => {
    assert.deepEqual(
      validateClinicChangeRequest({
        current,
        requested: pick({ clinicId: "clinic-9", name: "Paphos Medical Centre", phone: "", location: paphosPin }),
      }),
      {
        ok: true,
        changes: { clinicId: "clinic-9", name: "Paphos Medical Centre", address: paphosPin.address },
      },
    );
  });

  it("normalises the phone and ignores formatting-only differences", () => {
    assert.deepEqual(
      validateClinicChangeRequest({ current, requested: pick({ phone: "+357 25 123456", name: "  Limassol   Skin Clinic " }) }),
      { ok: false, field: null, message: "Change at least one detail." },
    );
    assert.deepEqual(validateClinicChangeRequest({ current, requested: pick({ phone: "26 123456" }) }), {
      ok: true,
      changes: { phone: "26123456" },
    });
  });

  it("asks for a change when nothing is different", () => {
    assert.deepEqual(validateClinicChangeRequest({ current, requested: pick() }), {
      ok: false,
      field: null,
      message: "Change at least one detail.",
    });
  });

  it("needs a clinic name of up to 120 characters, like /register", () => {
    assert.deepEqual(validateClinicChangeRequest({ current, requested: pick({ name: "   " }) }), {
      ok: false,
      field: "name",
      message: "Enter the clinic name.",
    });
    assert.deepEqual(validateClinicChangeRequest({ current, requested: pick({ name: "x".repeat(121) }) }), {
      ok: false,
      field: "name",
      message: "Keep the clinic name under 120 characters.",
    });
  });

  it("changes only the phone of a clinic with a long DocCy name", () => {
    const longName = "WellClub - Wellness Family Experience clinic";
    assert.deepEqual(
      validateClinicChangeRequest({
        current: { ...current, name: longName },
        requested: pick({ name: longName, phone: "26 123456" }),
      }),
      { ok: true, changes: { phone: "26123456" } },
    );
  });

  it("refuses a phone that is not a Cyprus line, and never removes one", () => {
    const bad = validateClinicChangeRequest({ current, requested: pick({ phone: "12345" }) });
    assert.equal(bad.ok === false && bad.field, "phone");
    assert.deepEqual(validateClinicChangeRequest({ current, requested: pick({ phone: "" }) }), {
      ok: false,
      field: "phone",
      message: "Enter the clinic phone.",
    });
  });
});

describe("validateNewClinic", () => {
  it("links a DocCy clinic by id", () => {
    assert.deepEqual(
      validateNewClinic({ clinicId: "clinic-9", name: "Paphos Medical Centre", phone: "", location: paphosPin }),
      { ok: true, clinic: { clinicId: "clinic-9", name: "Paphos Medical Centre", location: paphosPin } },
    );
  });

  it("creates a clinic found on Google with its name, phone and pin", () => {
    assert.deepEqual(
      validateNewClinic({ clinicId: null, name: " Skin Clinic ", phone: "25 123456", location: limassolPin }),
      {
        ok: true,
        clinic: { clinicId: null, name: "Skin Clinic", phone: "25123456", location: limassolPin },
      },
    );
  });

  it("needs a place first", () => {
    assert.deepEqual(validateNewClinic({ clinicId: null, name: "", phone: "", location: noLocation }), {
      ok: false,
      field: "location",
      message: "Find your clinic first.",
    });
  });

  it("needs a name and a Cyprus phone for a new clinic", () => {
    assert.deepEqual(validateNewClinic({ clinicId: null, name: "", phone: "25123456", location: limassolPin }), {
      ok: false,
      field: "name",
      message: "Enter the clinic name.",
    });
    const phone = validateNewClinic({ clinicId: null, name: "Skin Clinic", phone: "123", location: limassolPin });
    assert.equal(phone.ok === false && phone.field, "phone");
  });
});
