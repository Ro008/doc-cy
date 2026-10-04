import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PATIENT_GENDER_OPTIONS,
  parseBookingPatientFields,
} from "../../lib/booking-patient-fields";

/**
 * The booking form (user, 2026-10-02): name, email, phone, first visit, reason, gender
 * (female / male / prefer_not_to_say) and birth date are all required; the email is
 * optional for manual bookings. Mirrors appointments_booking_fields_check.
 */
const TODAY = new Date("2026-10-04T10:00:00Z");

const valid = {
  patientName: "  Maria   Kyriakou ",
  patientEmail: " maria@example.com ",
  patientPhone: " +357 99 123456 ",
  isNewPatient: true,
  reason: "  Knee pain  ",
  patientGender: "female",
  patientBirthdate: "1990-05-17",
};

describe("PATIENT_GENDER_OPTIONS", () => {
  it("are the three agreed values", () => {
    assert.deepEqual([...PATIENT_GENDER_OPTIONS], ["female", "male", "prefer_not_to_say"]);
  });
});

describe("parseBookingPatientFields (online)", () => {
  it("accepts a complete form and normalises it", () => {
    assert.deepEqual(parseBookingPatientFields(valid, "online", TODAY), {
      ok: true,
      fields: {
        patientName: "Maria Kyriakou",
        patientEmail: "maria@example.com",
        patientPhone: "+357 99 123456",
        isNewPatient: true,
        reason: "Knee pain",
        patientGender: "female",
        patientBirthdate: "1990-05-17",
      },
    });
  });

  it("accepts 'returning' as not a first visit", () => {
    const res = parseBookingPatientFields({ ...valid, isNewPatient: "returning" }, "online", TODAY);
    assert.equal(res.ok && res.fields.isNewPatient, false);
  });

  const missing: [string, Record<string, unknown>, string][] = [
    ["name", { patientName: "  " }, "name"],
    ["email", { patientEmail: "" }, "email"],
    ["a malformed email", { patientEmail: "maria@" }, "email"],
    ["phone", { patientPhone: undefined }, "phone"],
    ["first visit", { isNewPatient: undefined }, "first visit"],
    ["reason", { reason: "   " }, "why"],
    ["gender", { patientGender: undefined }, "gender"],
    ["an unknown gender", { patientGender: "other" }, "gender"],
    ["birth date", { patientBirthdate: "" }, "birth"],
    ["an impossible birth date", { patientBirthdate: "1990-02-30" }, "birth"],
    ["a badly formatted birth date", { patientBirthdate: "17/05/1990" }, "birth"],
    ["a birth date before 1900", { patientBirthdate: "1899-12-31" }, "birth"],
    ["a birth date in the future", { patientBirthdate: "2026-10-05" }, "birth"],
  ];
  for (const [label, patch, hint] of missing) {
    it(`refuses ${label}`, () => {
      const res = parseBookingPatientFields({ ...valid, ...patch }, "online", TODAY);
      assert.equal(res.ok, false);
      assert.match(res.ok ? "" : res.message.toLowerCase(), new RegExp(hint));
    });
  }

  it("accepts a baby born today", () => {
    const res = parseBookingPatientFields({ ...valid, patientBirthdate: "2026-10-04" }, "online", TODAY);
    assert.equal(res.ok, true);
  });

  it("caps the reason at 2000 characters", () => {
    const res = parseBookingPatientFields({ ...valid, reason: "x".repeat(2500) }, "online", TODAY);
    assert.equal(res.ok && res.fields.reason.length, 2000);
  });
});

describe("parseBookingPatientFields (manual)", () => {
  it("lets the email be left out", () => {
    const res = parseBookingPatientFields({ ...valid, patientEmail: "  " }, "manual", TODAY);
    assert.equal(res.ok, true);
    assert.equal(res.ok && res.fields.patientEmail, null);
  });

  it("still checks an email that was entered", () => {
    const res = parseBookingPatientFields({ ...valid, patientEmail: "nope" }, "manual", TODAY);
    assert.equal(res.ok, false);
  });

  it("still requires gender and birth date", () => {
    assert.equal(parseBookingPatientFields({ ...valid, patientGender: "" }, "manual", TODAY).ok, false);
    assert.equal(parseBookingPatientFields({ ...valid, patientBirthdate: null }, "manual", TODAY).ok, false);
  });
});
