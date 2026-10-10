import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOKING_FORM_FIELDS,
  firstBookingFormError,
  type BookingFormValues,
} from "../../lib/booking-form-validation";

const complete: BookingFormValues = {
  patientName: "Maria Georgiou",
  patientEmail: "maria@example.test",
  patientPhone: "+35799123456",
  phoneValid: true,
  isNewPatient: true,
  patientGender: "female",
  patientBirthdate: "1990-05-12",
  visitReason: "Check-up",
};

describe("firstBookingFormError", () => {
  it("accepts a complete form", () => {
    assert.equal(firstBookingFormError(complete), null);
  });

  it("names the exact field that is missing, with its own message", () => {
    assert.deepEqual(firstBookingFormError({ ...complete, patientName: "  " }), {
      field: "patientName",
      messageKey: "nameRequired",
    });
    assert.deepEqual(firstBookingFormError({ ...complete, patientEmail: "" }), {
      field: "patientEmail",
      messageKey: "emailRequired",
    });
    assert.deepEqual(firstBookingFormError({ ...complete, patientPhone: "" }), {
      field: "patientPhone",
      messageKey: "phoneRequired",
    });
    assert.deepEqual(firstBookingFormError({ ...complete, isNewPatient: null }), {
      field: "isNewPatient",
      messageKey: "selectVisitHistory",
    });
    assert.deepEqual(firstBookingFormError({ ...complete, patientGender: "" }), {
      field: "patientGender",
      messageKey: "genderRequired",
    });
    assert.deepEqual(firstBookingFormError({ ...complete, patientBirthdate: "" }), {
      field: "patientBirthdate",
      messageKey: "birthdateRequired",
    });
    assert.deepEqual(firstBookingFormError({ ...complete, visitReason: "   " }), {
      field: "visitReason",
      messageKey: "reasonRequired",
    });
  });

  it("checks the email looks like an address", () => {
    assert.deepEqual(firstBookingFormError({ ...complete, patientEmail: "maria@" }), {
      field: "patientEmail",
      messageKey: "validEmail",
    });
    assert.equal(firstBookingFormError({ ...complete, patientEmail: " maria+p2@example.test " }), null);
  });

  it("treats a phone box left with only the country code as missing", () => {
    assert.deepEqual(firstBookingFormError({ ...complete, patientPhone: "+357", phoneValid: false }), {
      field: "patientPhone",
      messageKey: "phoneRequired",
    });
  });

  it("tells an invalid phone apart from a missing one", () => {
    assert.deepEqual(firstBookingFormError({ ...complete, phoneValid: false }), {
      field: "patientPhone",
      messageKey: "validPhone",
    });
  });

  it("rejects an impossible birth date", () => {
    assert.deepEqual(firstBookingFormError({ ...complete, patientBirthdate: "2999-01-01" }), {
      field: "patientBirthdate",
      messageKey: "birthdateRequired",
    });
  });

  it("reports the first problem in the order the fields appear on screen", () => {
    assert.deepEqual(BOOKING_FORM_FIELDS, [
      "patientName",
      "patientEmail",
      "patientPhone",
      "isNewPatient",
      "patientGender",
      "patientBirthdate",
      "professionalService",
      "visitReason",
    ]);
    // Gender sits above the reason, so it is reported first.
    assert.equal(
      firstBookingFormError({ ...complete, patientGender: "", visitReason: "" })?.field,
      "patientGender",
    );
    assert.equal(
      firstBookingFormError({ ...complete, patientPhone: "", patientGender: "" })?.field,
      "patientPhone",
    );
  });

  // The service picker (user, 2026-10-09): shown only when the professional lists services.
  describe("service choice", () => {
    const serviceId = "6a1f8a52-2b8f-4c1e-9d55-0f3c2a7b9e10";

    it("asks for nothing when the professional lists no services (reason only, as before)", () => {
      assert.equal(firstBookingFormError({ ...complete, serviceChoice: null }), null);
      assert.equal(firstBookingFormError({ ...complete }), null);
      assert.deepEqual(firstBookingFormError({ ...complete, serviceChoice: null, visitReason: "" }), {
        field: "visitReason",
        messageKey: "reasonRequired",
      });
    });

    it("requires a choice when there are services", () => {
      assert.deepEqual(firstBookingFormError({ ...complete, serviceChoice: "" }), {
        field: "professionalService",
        messageKey: "serviceRequired",
      });
    });

    it("a chosen service makes the free text optional", () => {
      assert.equal(firstBookingFormError({ ...complete, serviceChoice: serviceId, visitReason: "" }), null);
    });

    it("Other asks for the free text", () => {
      assert.deepEqual(firstBookingFormError({ ...complete, serviceChoice: "other", visitReason: " " }), {
        field: "visitReason",
        messageKey: "reasonRequired",
      });
      assert.equal(firstBookingFormError({ ...complete, serviceChoice: "other" }), null);
    });

    it("sits below the date of birth", () => {
      assert.equal(
        firstBookingFormError({ ...complete, serviceChoice: "", patientBirthdate: "" })?.field,
        "patientBirthdate",
      );
    });
  });
});
