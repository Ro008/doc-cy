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
  it("accepts usual ways of writing a phone number", () => {
    for (const ok of ["+357 99 123456", "99123456", "+357-99-123-456", "(+357) 99 123 456", "00357 99123456"]) {
      assert.equal(manualPhoneProblem(ok), null, ok);
    }
  });

  it("asks for a phone when it is empty", () => {
    assert.equal(manualPhoneProblem("   "), "required");
  });

  it("refuses letters and other characters", () => {
    assert.equal(manualPhoneProblem("+35799991351sgdfe3456 36"), "invalid");
    assert.equal(manualPhoneProblem("99 12#3456"), "invalid");
  });

  it("only allows + at the start", () => {
    assert.equal(manualPhoneProblem("99+123456"), "invalid");
  });

  it("needs between 7 and 15 digits", () => {
    assert.equal(manualPhoneProblem("123456"), "invalid");
    assert.equal(manualPhoneProblem("1234567"), null);
    assert.equal(manualPhoneProblem("+1234567890123456"), "invalid");
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

  it("explains a malformed phone", () => {
    assert.deepEqual(firstManualBookingError({ ...minimal, patientPhone: "99abc123" }, NOW), {
      field: "patientPhone",
      message: "Use digits only, with an optional + at the start (7 to 15 digits).",
    });
  });

  it("checks optional fields only when they are filled in", () => {
    assert.equal(firstManualBookingError({ ...minimal, patientEmail: "maria@" }, NOW)?.field, "patientEmail");
    assert.equal(firstManualBookingError({ ...minimal, patientEmail: "maria@example.test" }, NOW), null);
    assert.equal(firstManualBookingError({ ...minimal, patientBirthdate: "2999-01-01" }, NOW)?.field, "patientBirthdate");
    assert.equal(firstManualBookingError({ ...minimal, patientBirthdate: "1990-05-12" }, NOW), null);
  });
});
