import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  firstManualBookingError,
  manualPhoneProblem,
  type ManualBookingValues,
} from "../../lib/manual-booking-validation";

const NOW = new Date("2026-10-06T09:00:00Z");

const minimal: ManualBookingValues = {
  patientName: "Maria Georgiou",
  patientPhone: "+357 99 123456",
  patientEmail: "",
  patientBirthdate: "",
  reason: "Called in, back pain",
};

describe("manualPhoneProblem", () => {
  it("accepts real mobile numbers written the usual ways", () => {
    for (const ok of [
      "+357 99 123456",
      "+357-99-123-456",
      "(+357) 99 123 456",
      "00357 99123456",
      "+30 691 234 5678",
      "+44 7400 123456",
      "+34 667 000 000",
    ]) {
      assert.equal(manualPhoneProblem(ok), null, ok);
    }
  });

  it("asks for a phone when it is empty", () => {
    assert.equal(manualPhoneProblem("   "), "required");
  });

  it("refuses letters and other characters", () => {
    assert.equal(manualPhoneProblem("+35799991351sgdfe3456 36"), "invalid");
    assert.equal(manualPhoneProblem("+357 99 12#3456"), "invalid");
  });

  it("only allows + at the start", () => {
    assert.equal(manualPhoneProblem("+357 99+123456"), "invalid");
  });

  it("refuses landlines", () => {
    assert.equal(manualPhoneProblem("+357 22 123456"), "invalid");
    assert.equal(manualPhoneProblem("+44 20 7946 0958"), "invalid");
  });

  it("refuses a right-length number with a wrong mobile prefix", () => {
    assert.equal(manualPhoneProblem("+34 123 456 789"), "invalid");
    assert.equal(manualPhoneProblem("+357 11 123456"), "invalid");
  });

  it("refuses numbers that are too short or too long", () => {
    assert.equal(manualPhoneProblem("+357 99 1234"), "invalid");
    assert.equal(manualPhoneProblem("+357 99 1234567"), "invalid");
  });

  it("needs the country code", () => {
    assert.equal(manualPhoneProblem("99123456"), "invalid");
  });
});

describe("firstManualBookingError", () => {
  it("accepts a booking with only name, phone and reason", () => {
    assert.equal(firstManualBookingError(minimal, NOW), null);
  });

  it("still requires name, phone and reason", () => {
    assert.equal(firstManualBookingError({ ...minimal, patientName: " " }, NOW)?.field, "patientName");
    assert.equal(firstManualBookingError({ ...minimal, patientPhone: "" }, NOW)?.field, "patientPhone");
    assert.equal(firstManualBookingError({ ...minimal, reason: "  " }, NOW)?.field, "reason");
  });

  it("uses the phone box's own check, like online booking", () => {
    assert.deepEqual(firstManualBookingError({ ...minimal, phoneValid: false }, NOW), {
      field: "patientPhone",
      message: "Enter a valid mobile number for the selected country.",
    });
  });

  it("treats a phone box left with only the country code as missing", () => {
    assert.deepEqual(firstManualBookingError({ ...minimal, patientPhone: "+357", phoneValid: false }, NOW), {
      field: "patientPhone",
      message: "Enter the patient's phone number.",
    });
  });

  it("explains a malformed phone", () => {
    assert.deepEqual(firstManualBookingError({ ...minimal, patientPhone: "99abc123" }, NOW), {
      field: "patientPhone",
      message: "Enter a valid mobile number with its country code.",
    });
  });

  it("checks optional fields only when they are filled in", () => {
    assert.equal(firstManualBookingError({ ...minimal, patientEmail: "maria@" }, NOW)?.field, "patientEmail");
    assert.equal(firstManualBookingError({ ...minimal, patientEmail: "maria@example.test" }, NOW), null);
    assert.equal(firstManualBookingError({ ...minimal, patientBirthdate: "2999-01-01" }, NOW)?.field, "patientBirthdate");
    assert.equal(firstManualBookingError({ ...minimal, patientBirthdate: "1990-05-12" }, NOW), null);
  });
});
