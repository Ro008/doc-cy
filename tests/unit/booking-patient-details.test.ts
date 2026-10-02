import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOOKING_PATIENT_DETAILS_BACKEND,
  PATIENT_GENDERS,
  bookingPatientDetailsPayload,
  dateOfBirthBounds,
  validateDateOfBirth,
} from "../../lib/booking-patient-details";

const today = new Date(2026, 9, 2); // 2 Oct 2026, local

describe("PATIENT_GENDERS", () => {
  it("offers male, female and prefer not to say", () => {
    assert.deepEqual([...PATIENT_GENDERS], ["male", "female", "prefer_not_to_say"]);
  });
});

describe("validateDateOfBirth", () => {
  it("accepts a real past date", () => {
    assert.equal(validateDateOfBirth("1985-04-23", today), null);
    assert.equal(validateDateOfBirth("2026-10-02", today), null); // a newborn, today
  });

  it("asks for it when empty", () => {
    assert.equal(validateDateOfBirth("", today), "missing");
    assert.equal(validateDateOfBirth("   ", today), "missing");
  });

  it("rejects impossible or malformed dates", () => {
    assert.equal(validateDateOfBirth("1985-02-30", today), "invalid");
    assert.equal(validateDateOfBirth("23/04/1985", today), "invalid");
    assert.equal(validateDateOfBirth("1985-13-01", today), "invalid");
  });

  it("rejects the future and ages over 120", () => {
    assert.equal(validateDateOfBirth("2026-10-03", today), "future");
    assert.equal(validateDateOfBirth("1906-10-01", today), "too_old");
    assert.equal(validateDateOfBirth("1906-10-02", today), null);
  });
});

describe("dateOfBirthBounds", () => {
  it("gives the date input its min and max", () => {
    assert.deepEqual(dateOfBirthBounds(today), { min: "1906-10-02", max: "2026-10-02" });
  });
});

describe("booking patient details contract", () => {
  it("adds gender and date of birth to the booking request body", () => {
    assert.deepEqual(bookingPatientDetailsPayload({ gender: "female", dateOfBirth: "1985-04-23" }), {
      patientGender: "female",
      patientDateOfBirth: "1985-04-23",
    });
  });

  it("names what Livio stores", () => {
    assert.deepEqual(BOOKING_PATIENT_DETAILS_BACKEND, {
      endpoint: "POST /api/appointments",
      bodyFields: ["patientGender", "patientDateOfBirth"],
      columns: ["appointments.patient_gender", "appointments.patient_date_of_birth"],
    });
  });
});
