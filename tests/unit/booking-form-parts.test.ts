import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { birthdateFromParts, fullPatientName, mobilePlaceholder } from "../../lib/booking-form-parts";

/** Pieces of the public booking form (user, 2026-10-10): name in two boxes, birth date in three. */

describe("fullPatientName", () => {
  it("joins first and last name for the one patient_name column", () => {
    assert.equal(fullPatientName(" Maria ", "  Georgiou "), "Maria Georgiou");
    assert.equal(fullPatientName("Alexander", "G"), "Alexander G");
    assert.equal(fullPatientName("Ana  María", "de la  Cruz"), "Ana María de la Cruz");
  });
});

describe("birthdateFromParts (Day / Month / Year boxes)", () => {
  it("builds YYYY-MM-DD, padding one-digit day and month", () => {
    assert.equal(birthdateFromParts({ day: "7", month: "3", year: "1985" }), "1985-03-07");
    assert.equal(birthdateFromParts({ day: "27", month: "12", year: "1990" }), "1990-12-27");
  });

  it("returns nothing usable while a box is empty or not a number", () => {
    assert.equal(birthdateFromParts({ day: "", month: "3", year: "1985" }), "");
    assert.equal(birthdateFromParts({ day: "7", month: "3", year: "85" }), "");
    assert.equal(birthdateFromParts({ day: "x", month: "3", year: "1985" }), "");
  });

  it("leaves impossible dates for the form's check to refuse", () => {
    // 31 February is built as typed; parsePatientBirthdate then refuses it.
    assert.equal(birthdateFromParts({ day: "31", month: "2", year: "1990" }), "1990-02-31");
  });
});

describe("mobilePlaceholder", () => {
  it("shows an example mobile for the chosen country, after its dial code", () => {
    assert.match(mobilePlaceholder("cy"), /^9\d \d{6}$/);
    assert.match(mobilePlaceholder("gb"), /^7\d{3} \d{6}$/);
  });

  it("is empty for an unknown country", () => {
    assert.equal(mobilePlaceholder("zz"), "");
  });
});
