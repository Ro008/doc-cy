import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FORMER_CLINIC_SWATCH,
  groupVisitsByMonth,
  pastVisitFacets,
  patientVisitCounts,
  visitBookingLabel,
  visitClinicMap,
  visitDateParts,
  visitTimeRange,
} from "../../lib/past-visits-view";

/**
 * The Visits tab's cards (user, 2026-10-12): a date tile, the time, the clinic, and the
 * visits grouped under month headings. All in Cyprus time.
 */
describe("visitDateParts", () => {
  it("splits a visit into the pieces of the date tile, in Cyprus time", () => {
    // 21:30Z on 11 Oct is already 12 Oct 00:30 in Cyprus (UTC+3).
    assert.deepEqual(visitDateParts("2026-10-11T21:30:00Z"), {
      day: "12",
      month: "OCT",
      weekday: "Mon",
      time: "00:30",
    });
  });

  it("doesn't pad the day", () => {
    assert.equal(visitDateParts("2026-03-04T09:00:00Z").day, "4");
  });
});

describe("visitTimeRange", () => {
  it("shows when the visit started and ended, in Cyprus time", () => {
    assert.equal(visitTimeRange("2026-10-13T06:30:00Z", 30), "09:30–10:00");
    assert.equal(visitTimeRange("2026-10-13T20:45:00Z", 45), "23:45–00:30");
  });

  it("is the start alone when the length is unknown", () => {
    assert.equal(visitTimeRange("2026-10-13T06:30:00Z", null), "09:30");
    assert.equal(visitTimeRange("2026-10-13T06:30:00Z", 0), "09:30");
  });
});

describe("visitBookingLabel", () => {
  it("says how the visit was booked", () => {
    assert.equal(visitBookingLabel("online"), "Booked online");
    assert.equal(visitBookingLabel("manual"), "Manual booking");
  });

  it("says nothing for older visits with no source", () => {
    assert.equal(visitBookingLabel(null), null);
    assert.equal(visitBookingLabel("something else"), null);
  });
});

/**
 * Every visit shows its clinic, also one she has since left (user, 2026-10-13): the names come
 * from the clinics of her visits, not from her current clinics.
 */
describe("visitClinicMap", () => {
  const names = { a: "Clinic A", b: "Clinic B", gone: "Clinic she left" };

  it("gives her current clinics their agenda colour, in her order", () => {
    const map = visitClinicMap(names, ["b", "a"]);
    assert.equal(map.b!.name, "Clinic B");
    assert.equal(map.b!.swatch, "bg-clinical-400");
    assert.equal(map.a!.swatch, "bg-violet-400");
    assert.equal(map.a!.former, false);
  });

  it("keeps a clinic she left, in a neutral colour", () => {
    const map = visitClinicMap(names, ["a"]);
    assert.deepEqual(map.gone, { name: "Clinic she left", swatch: FORMER_CLINIC_SWATCH, former: true });
  });

  it("has every named clinic even when she has a single one", () => {
    assert.deepEqual(Object.keys(visitClinicMap({ a: "Clinic A" }, ["a"])), ["a"]);
  });
});

describe("pastVisitFacets", () => {
  const row = (clinic_id: string | null, service_name: string | null) => ({
    clinic_id,
    service_name,
    patient_email: null,
    patient_phone: null,
  });

  it("lists the clinics and services that appear in her visits, once each", () => {
    const facets = pastVisitFacets([row("a", "Scan"), row("b", null), row("a", " Check-up "), row(null, "Scan")]);
    assert.deepEqual(facets.clinicIds, ["a", "b"]);
    assert.deepEqual(facets.serviceNames, ["Check-up", "Scan"]);
  });

  it("is empty with no visits", () => {
    assert.deepEqual(pastVisitFacets([]), { clinicIds: [], serviceNames: [] });
  });
});

describe("patientVisitCounts", () => {
  const all = [
    { clinic_id: null, service_name: null, patient_email: "Maria@Example.com", patient_phone: null },
    { clinic_id: null, service_name: null, patient_email: "maria@example.com", patient_phone: "+357 99 444 555" },
    { clinic_id: null, service_name: null, patient_email: null, patient_phone: "99444555" },
    { clinic_id: null, service_name: null, patient_email: "other@example.com", patient_phone: "99000111" },
  ];

  it("counts her visits with the same patient, matched on email or phone", () => {
    const counts = patientVisitCounts(
      [
        { id: "v1", patient_email: "maria@example.com", patient_phone: "+35799444555" },
        { id: "v2", patient_email: "other@example.com", patient_phone: null },
      ],
      all,
    );
    assert.deepEqual(counts, { v1: 3, v2: 1 });
  });

  it("has no count for a visit with nothing to match on", () => {
    assert.deepEqual(patientVisitCounts([{ id: "v3", patient_email: null, patient_phone: "12" }], all), {});
  });
});

describe("groupVisitsByMonth", () => {
  const v = (id: string, iso: string) => ({ id, appointment_datetime: iso });

  it("groups consecutive visits under their month, keeping the order", () => {
    const groups = groupVisitsByMonth([
      v("a", "2026-10-12T09:00:00Z"),
      v("b", "2026-10-08T09:00:00Z"),
      v("c", "2026-09-30T09:00:00Z"),
      v("d", "2026-01-02T09:00:00Z"),
    ]);
    assert.deepEqual(
      groups.map((g) => [g.key, g.label, g.visits.map((x) => x.id)]),
      [
        ["2026-10", "October 2026", ["a", "b"]],
        ["2026-09", "September 2026", ["c"]],
        ["2026-01", "January 2026", ["d"]],
      ],
    );
  });

  it("uses Cyprus time for the month boundary", () => {
    // 30 Sep 22:00Z is 1 Oct 01:00 in Cyprus.
    assert.equal(groupVisitsByMonth([v("a", "2026-09-30T22:00:00Z")])[0]!.key, "2026-10");
  });

  it("is empty for no visits", () => {
    assert.deepEqual(groupVisitsByMonth([]), []);
  });
});
