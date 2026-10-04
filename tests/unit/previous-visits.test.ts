import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isSamePatient,
  phoneKey,
  previousVisitsOrFilter,
  selectPreviousVisits,
} from "../../lib/previous-visits";

/**
 * "Previous visits with you" on a new request (user, 2026-10-04): her past confirmed visits
 * matched on email or phone (a suggestion until patient accounts exist), with her notes.
 */
describe("phoneKey", () => {
  it("compares the last 8 digits, ignoring the country code and spacing", () => {
    assert.equal(phoneKey("+357 99 444 555"), "99444555");
    assert.equal(phoneKey("0035799444555"), "99444555");
    assert.equal(phoneKey("99-444-555"), "99444555");
  });

  it("is null when there aren't 8 digits", () => {
    assert.equal(phoneKey("12345"), null);
    assert.equal(phoneKey(null), null);
    assert.equal(phoneKey(""), null);
  });
});

describe("isSamePatient", () => {
  const who = { email: "Maria@Example.com ", phone: "+35799444555" };

  it("matches the email ignoring case and spaces", () => {
    assert.equal(isSamePatient({ patient_email: "maria@example.com", patient_phone: null }, who), true);
  });

  it("matches the phone", () => {
    assert.equal(isSamePatient({ patient_email: null, patient_phone: "99 444 555" }, who), true);
  });

  it("doesn't match on nothing", () => {
    assert.equal(isSamePatient({ patient_email: "other@example.com", patient_phone: "99000111" }, who), false);
    assert.equal(isSamePatient({ patient_email: null, patient_phone: null }, { email: null, phone: null }), false);
  });
});

describe("previousVisitsOrFilter", () => {
  it("builds a quoted PostgREST filter on email and phone", () => {
    assert.equal(
      previousVisitsOrFilter({ email: "Maria@Example.com", phone: "+35799444555" }),
      // Inside PostgREST quotes each regex backslash is doubled.
      String.raw`patient_email.ilike."maria@example.com",patient_phone.match."9\\D*9\\D*4\\D*4\\D*4\\D*5\\D*5\\D*5\\D*$"`,
    );
  });

  it("escapes LIKE wildcards and quotes in the email", () => {
    assert.equal(
      previousVisitsOrFilter({ email: 'a_b%c"d@x.com', phone: null }),
      'patient_email.ilike."a\\\\_b\\\\%c\\"d@x.com"',
    );
  });

  it("is null with neither", () => {
    assert.equal(previousVisitsOrFilter({ email: " ", phone: "123" }), null);
  });
});

describe("selectPreviousVisits", () => {
  const who = { email: "maria@example.com", phone: null };
  const row = (id: string, at: string, email = "maria@example.com") => ({
    id,
    appointment_datetime: at,
    patient_email: email,
    patient_phone: null,
    attendance: null,
    professional_notes: null,
    clinic_id: null,
  });

  it("keeps the same patient's visits, newest first, at most the limit", () => {
    const rows = [
      row("old", "2026-01-01T08:00:00Z"),
      row("other", "2026-05-01T08:00:00Z", "x@example.com"),
      row("new", "2026-09-01T08:00:00Z"),
      row("mid", "2026-04-01T08:00:00Z"),
    ];
    assert.deepEqual(selectPreviousVisits(rows, who, 2).map((r) => r.id), ["new", "mid"]);
  });
});
