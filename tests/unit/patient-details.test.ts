import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  patientAgeYears,
  patientBirthdateLabel,
  patientGenderLabel,
  patientSummaryParts,
} from "../../lib/patient-details";

/**
 * What the professional sees about a patient on the agenda and the request page
 * (user, 2026-10-06): age, gender, first visit or not, phone, email.
 */
describe("patientAgeYears", () => {
  const now = new Date("2026-10-06T09:00:00Z");

  it("counts full years in Cyprus time", () => {
    assert.equal(patientAgeYears("1990-05-17", now), 36);
    assert.equal(patientAgeYears("1990-10-06", now), 36, "birthday today");
    assert.equal(patientAgeYears("1990-10-07", now), 35, "birthday tomorrow");
  });

  it("is null when the date is missing or unusable", () => {
    assert.equal(patientAgeYears(null, now), null);
    assert.equal(patientAgeYears("", now), null);
    assert.equal(patientAgeYears("not a date", now), null);
    assert.equal(patientAgeYears("2030-01-01", now), null, "future");
  });
});

describe("patientGenderLabel", () => {
  it("names female and male, and stays silent otherwise", () => {
    assert.equal(patientGenderLabel("female"), "Female");
    assert.equal(patientGenderLabel("male"), "Male");
    assert.equal(patientGenderLabel("prefer_not_to_say"), null);
    assert.equal(patientGenderLabel(null), null);
  });
});

describe("patientBirthdateLabel", () => {
  it("reads like a date, not an ISO string", () => {
    assert.equal(patientBirthdateLabel("1990-05-17"), "born 17 May 1990");
    assert.equal(patientBirthdateLabel(null), null);
  });
});

describe("patientSummaryParts", () => {
  const now = new Date("2026-10-06T09:00:00Z");

  it("age, gender and first visit, in that order", () => {
    assert.deepEqual(
      patientSummaryParts({ birthdate: "1990-05-17", gender: "female", isNewPatient: true }, now),
      ["36 years", "Female", "First visit"],
    );
  });

  it("says returning patient, and leaves out what is missing", () => {
    assert.deepEqual(
      patientSummaryParts({ birthdate: null, gender: "prefer_not_to_say", isNewPatient: false }, now),
      ["Returning patient"],
    );
    assert.deepEqual(patientSummaryParts({ birthdate: null, gender: null, isNewPatient: null }, now), []);
  });

  it("gives babies and toddlers (under 2) their age in months", () => {
    const age = (birthdate: string) => patientSummaryParts({ birthdate, gender: null, isNewPatient: null }, now);
    assert.deepEqual(age("2025-01-01"), ["21 months"]);
    assert.deepEqual(age("2026-09-01"), ["1 month"]);
    assert.deepEqual(age("2026-09-20"), ["0 months"]);
    assert.deepEqual(age("2024-10-06"), ["2 years"]);
  });
});
