import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PROFESSIONAL_NOTES_MAX,
  professionalNotesEditRefusal,
  parseProfessionalNotes,
} from "../../lib/professional-notes";

/**
 * Her private notes on a visit (user, 2026-10-04): optional plain text up to 2,000
 * characters, editable only by her, only once the visit has started and only while the row
 * is CONFIRMED (no-shows included).
 */
describe("parseProfessionalNotes", () => {
  it("trims and keeps the text", () => {
    assert.deepEqual(parseProfessionalNotes("  BP 120/80, follow up in 3 months. "), {
      ok: true,
      value: "BP 120/80, follow up in 3 months.",
    });
  });

  it("stores empty or missing as null (clears the note)", () => {
    for (const raw of ["", "   ", null, undefined]) {
      assert.deepEqual(parseProfessionalNotes(raw), { ok: true, value: null }, String(raw));
    }
  });

  it("refuses more than 2,000 characters", () => {
    assert.equal(PROFESSIONAL_NOTES_MAX, 2000);
    assert.equal(parseProfessionalNotes("a".repeat(2000)).ok, true);
    assert.equal(parseProfessionalNotes("a".repeat(2001)).ok, false);
  });

  it("refuses non-text", () => {
    assert.equal(parseProfessionalNotes(42).ok, false);
    assert.equal(parseProfessionalNotes({}).ok, false);
  });
});

describe("professionalNotesEditRefusal", () => {
  const start = "2026-10-05T07:00:00.000Z";

  it("allows a confirmed visit once it has started", () => {
    assert.equal(
      professionalNotesEditRefusal({ status: "CONFIRMED", appointmentIso: start, now: new Date(start) }),
      null,
    );
    assert.equal(
      professionalNotesEditRefusal({
        status: "CONFIRMED",
        appointmentIso: start,
        now: new Date("2026-11-05T07:00:00.000Z"),
      }),
      null,
    );
  });

  it("refuses before the visit starts", () => {
    assert.equal(
      professionalNotesEditRefusal({
        status: "CONFIRMED",
        appointmentIso: start,
        now: new Date("2026-10-05T06:59:00.000Z"),
      })?.code,
      "not_started",
    );
  });

  it("refuses rows that aren't confirmed", () => {
    for (const status of ["REQUESTED", "CANCELLED", "DECLINED", "EXPIRED"]) {
      assert.equal(
        professionalNotesEditRefusal({ status, appointmentIso: start, now: new Date("2026-10-06T00:00:00Z") })?.code,
        "not_confirmed",
      );
    }
  });
});
