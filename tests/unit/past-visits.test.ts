import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PAST_VISITS_MAX_PAGE,
  PAST_VISITS_PAGE_SIZE,
  isPastVisit,
  parsePastVisitsParams,
  pastVisitsDateBounds,
  pastVisitsHref,
  pastVisitsPageRange,
  pastVisitsSearchFilter,
  patientVisitsHref,
} from "../../lib/past-visits";

/**
 * "Visits" tab (user, 2026-10-09): the doctor's past visits with the patient's details, the
 * reason, the service and her notes; searchable; notes editable from there. A past visit is a
 * CONFIRMED appointment that has started (the same rule that lets her write notes).
 */
describe("isPastVisit", () => {
  const now = new Date("2026-10-09T10:00:00Z");

  it("is a confirmed visit that has started", () => {
    assert.equal(isPastVisit({ status: "CONFIRMED", appointment_datetime: "2026-10-09T09:59:00Z" }, now), true);
    assert.equal(isPastVisit({ status: "confirmed", appointment_datetime: "2026-10-01T09:00:00Z" }, now), true);
  });

  it("is not a future visit", () => {
    assert.equal(isPastVisit({ status: "CONFIRMED", appointment_datetime: "2026-10-09T10:01:00Z" }, now), false);
  });

  it("is not a visit that never took place", () => {
    for (const status of ["REQUESTED", "CANCELLED", "DECLINED", "EXPIRED", "NEEDS_RESCHEDULE", null]) {
      assert.equal(isPastVisit({ status, appointment_datetime: "2026-10-01T09:00:00Z" }, now), false, String(status));
    }
  });

  it("is not a row with a broken date", () => {
    assert.equal(isPastVisit({ status: "CONFIRMED", appointment_datetime: "nope" }, now), false);
  });
});

describe("parsePastVisitsParams", () => {
  it("defaults to everything, first page", () => {
    assert.deepEqual(parsePastVisitsParams({}), {
      q: "",
      from: null,
      to: null,
      clinicId: null,
      service: null,
      attendance: "all",
      notes: "all",
      patientId: null,
      page: 1,
    });
  });

  it("reads and trims the filters", () => {
    assert.deepEqual(
      parsePastVisitsParams({
        q: "  Maria  ",
        from: "2026-09-01",
        to: "2026-09-30",
        clinic: "0b1c8d52-6f0e-4d2a-8f3c-2f7d9a1b3c4d",
        service: " Check-up ",
        attendance: "no_show",
        notes: "missing",
        patient: "7d9a2f6e-1c3b-4a8e-9f10-2b4c6d8e0a12",
        page: "3",
      }),
      {
        q: "Maria",
        from: "2026-09-01",
        to: "2026-09-30",
        clinicId: "0b1c8d52-6f0e-4d2a-8f3c-2f7d9a1b3c4d",
        service: "Check-up",
        attendance: "no_show",
        notes: "missing",
        patientId: "7d9a2f6e-1c3b-4a8e-9f10-2b4c6d8e0a12",
        page: 3,
      },
    );
  });

  it("takes the first value of a repeated param", () => {
    assert.equal(parsePastVisitsParams({ q: ["a", "b"] }).q, "a");
  });

  it("drops what isn't valid instead of failing", () => {
    const p = parsePastVisitsParams({
      from: "yesterday",
      to: "2026-02-31",
      clinic: "not-a-uuid",
      attendance: "weird",
      notes: "nope",
      patient: "maria@example.com",
      page: "-4",
    });
    assert.equal(p.patientId, null);
    assert.equal(p.notes, "all");
    assert.equal(p.from, null);
    assert.equal(p.to, null);
    assert.equal(p.clinicId, null);
    assert.equal(p.attendance, "all");
    assert.equal(p.page, 1);
  });

  it("caps the length of the search text", () => {
    assert.equal(parsePastVisitsParams({ q: "x".repeat(500) }).q.length, 100);
  });

  it("swaps a range given backwards", () => {
    const p = parsePastVisitsParams({ from: "2026-09-30", to: "2026-09-01" });
    assert.equal(p.from, "2026-09-01");
    assert.equal(p.to, "2026-09-30");
  });
});

describe("pastVisitsDateBounds", () => {
  it("turns Cyprus calendar days into UTC bounds, the end day included", () => {
    // Cyprus is UTC+3 in October (until 25 Oct): 1 Oct 00:00 local = 30 Sep 21:00Z.
    assert.deepEqual(pastVisitsDateBounds("2026-10-01", "2026-10-02"), {
      fromIso: "2026-09-30T21:00:00.000Z",
      toIso: "2026-10-02T21:00:00.000Z",
    });
  });

  it("allows an open range", () => {
    assert.deepEqual(pastVisitsDateBounds(null, null), { fromIso: null, toIso: null });
    assert.equal(pastVisitsDateBounds("2026-10-01", null).toIso, null);
    assert.equal(pastVisitsDateBounds(null, "2026-10-01").fromIso, null);
  });

  it("follows the winter offset (UTC+2)", () => {
    assert.equal(pastVisitsDateBounds("2026-12-01", null).fromIso, "2026-11-30T22:00:00.000Z");
  });
});

describe("pastVisitsSearchFilter", () => {
  it("is null for an empty search", () => {
    assert.equal(pastVisitsSearchFilter(""), null);
    assert.equal(pastVisitsSearchFilter("   "), null);
  });

  it("searches name, email, reason, service and notes with a quoted ilike", () => {
    assert.equal(
      pastVisitsSearchFilter("maria"),
      [
        'patient_name.ilike."%maria%"',
        'patient_email.ilike."%maria%"',
        'reason.ilike."%maria%"',
        'service_name.ilike."%maria%"',
        'professional_notes.ilike."%maria%"',
      ].join(","),
    );
  });

  it("escapes LIKE wildcards and quotes, so the text is only ever text", () => {
    const f = pastVisitsSearchFilter('50%_off"),status.eq.CANCELLED');
    assert.ok(f);
    assert.ok(f.includes(String.raw`patient_name.ilike."%50\\%\\_off\"),status.eq.CANCELLED%"`), f);
  });

  it("adds the phone when the text looks like one, whatever the spacing", () => {
    const f = pastVisitsSearchFilter("99 444");
    assert.ok(f);
    assert.ok(f.includes(String.raw`patient_phone.match."9\\D*9\\D*4\\D*4\\D*4"`), f);
  });

  it("doesn't search the phone on a few digits or on words", () => {
    assert.ok(!pastVisitsSearchFilter("12")!.includes("patient_phone"));
    assert.ok(!pastVisitsSearchFilter("maria 99444")!.includes("patient_phone"));
  });
});

describe("pastVisitsPageRange", () => {
  it("pages from the first row", () => {
    assert.deepEqual(pastVisitsPageRange(1), { from: 0, to: PAST_VISITS_PAGE_SIZE - 1 });
    assert.deepEqual(pastVisitsPageRange(2), {
      from: PAST_VISITS_PAGE_SIZE,
      to: PAST_VISITS_PAGE_SIZE * 2 - 1,
    });
  });
});

describe("pastVisitsHref", () => {
  const base = parsePastVisitsParams({ q: "maria", attendance: "no_show" });

  it("is the bare path with the defaults", () => {
    assert.equal(pastVisitsHref(parsePastVisitsParams({})), "/agenda/visits");
  });

  it("keeps only what differs from the defaults", () => {
    assert.equal(pastVisitsHref(base), "/agenda/visits?q=maria&attendance=no_show");
  });

  it("changes the page and drops page 1", () => {
    assert.equal(pastVisitsHref(base, { page: 2 }), "/agenda/visits?q=maria&attendance=no_show&page=2");
    assert.equal(pastVisitsHref({ ...base, page: 3 }, { page: 1 }), "/agenda/visits?q=maria&attendance=no_show");
  });

  it("encodes the text", () => {
    assert.equal(pastVisitsHref(parsePastVisitsParams({ q: "a&b c" })), "/agenda/visits?q=a%26b+c");
  });
});

describe("visits without notes", () => {
  it("is a filter in the URL, left out when off", () => {
    const q = parsePastVisitsParams({ notes: "missing" });
    assert.equal(q.notes, "missing");
    assert.equal(pastVisitsHref(q), "/agenda/visits?notes=missing");
    assert.equal(pastVisitsHref(q, { notes: "all" }), "/agenda/visits");
  });
});

describe("page cap", () => {
  it("never goes past the last page a doctor could reasonably reach", () => {
    assert.equal(parsePastVisitsParams({ page: "99999999999" }).page, PAST_VISITS_MAX_PAGE);
    assert.equal(parsePastVisitsParams({ page: String(PAST_VISITS_MAX_PAGE) }).page, PAST_VISITS_MAX_PAGE);
    assert.equal(parsePastVisitsParams({ page: "2" }).page, 2);
  });
});

/**
 * The link to a patient's visits carries only the id of one of her visits, resolved on the
 * server: no email or phone ever sits in the URL (user, 2026-10-12).
 */
describe("patientVisitsHref", () => {
  const id = "7d9a2f6e-1c3b-4a8e-9f10-2b4c6d8e0a12";

  it("is the tab with the visit's id", () => {
    assert.equal(
      patientVisitsHref({ id, patient_email: "Maria@Example.com", patient_phone: "+357 99 444 555" }),
      `/agenda/visits?patient=${id}`,
    );
  });

  it("never puts the email or the phone in the URL", () => {
    const href = patientVisitsHref({ id, patient_email: "maria@example.com", patient_phone: "+35799444555" })!;
    assert.equal(href.includes("maria"), false);
    assert.equal(href.includes("357"), false);
    assert.equal(href.includes("%40"), false);
  });

  it("works with the phone alone", () => {
    assert.equal(patientVisitsHref({ id, patient_email: null, patient_phone: "99 444 555" }), `/agenda/visits?patient=${id}`);
  });

  it("is null when there is nothing to match on", () => {
    assert.equal(patientVisitsHref({ id, patient_email: " ", patient_phone: "12" }), null);
    assert.equal(patientVisitsHref({ id, patient_email: null, patient_phone: null }), null);
  });

  it("is kept in the URL together with the other filters, and dropped to clear", () => {
    const q = parsePastVisitsParams({ patient: id, attendance: "no_show" });
    assert.equal(pastVisitsHref(q), `/agenda/visits?attendance=no_show&patient=${id}`);
    assert.equal(pastVisitsHref(q, { patientId: null }), "/agenda/visits?attendance=no_show");
  });
});
