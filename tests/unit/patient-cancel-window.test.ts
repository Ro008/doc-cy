import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadVisitCancelNoticeHours, visitCancelNoticeHours } from "../../lib/visit-cancel-notice";

import {
  DEFAULT_PATIENT_CANCEL_NOTICE_HOURS,
  PATIENT_CANCEL_NOTICE_CHOICES,
  patientCancelDeadline,
  patientCanCancel,
  parsePatientCancelNoticeHours,
  professionalCancelIsShortNotice,
} from "../../lib/patient-cancel-window";

/**
 * The patient cancels a confirmed visit from the emailed link until X hours before it
 * (X = professional_settings.patient_cancel_notice_hours: 12 / 24 / 48, default 12 since
 * 2026-10-08, agreed with Livio, so the 24 h reminder can still carry the cancel link).
 * The professional can cancel until the visit starts; inside the patient's window the
 * dialog warns it is short notice (user, 2026-10-04).
 */
const VISIT = "2026-10-10T09:00:00Z";

describe("patient cancel notice setting", () => {
  it("defaults to 12 h and offers 12 / 24 / 48", () => {
    assert.equal(DEFAULT_PATIENT_CANCEL_NOTICE_HOURS, 12);
    assert.deepEqual([...PATIENT_CANCEL_NOTICE_CHOICES], [12, 24, 48]);
  });

  it("parses only the allowed values, else the default", () => {
    assert.equal(parsePatientCancelNoticeHours(12), 12);
    assert.equal(parsePatientCancelNoticeHours("48"), 48);
    for (const bad of [0, 36, -24, "24h", null, undefined, 24.5]) {
      assert.equal(parsePatientCancelNoticeHours(bad), 12, String(bad));
    }
  });
});

describe("patientCancelDeadline", () => {
  it("is the visit time minus the notice hours", () => {
    assert.equal(patientCancelDeadline(VISIT, 24).toISOString(), "2026-10-09T09:00:00.000Z");
    assert.equal(patientCancelDeadline(VISIT, 12).toISOString(), "2026-10-09T21:00:00.000Z");
  });
});

describe("patientCanCancel", () => {
  it("is true before the deadline, including the exact deadline", () => {
    assert.equal(patientCanCancel(VISIT, 24, new Date("2026-10-08T09:00:00Z")), true);
    assert.equal(patientCanCancel(VISIT, 24, new Date("2026-10-09T09:00:00Z")), true);
  });

  it("is false after the deadline and after the visit", () => {
    assert.equal(patientCanCancel(VISIT, 24, new Date("2026-10-09T09:00:01Z")), false);
    assert.equal(patientCanCancel(VISIT, 12, new Date("2026-10-10T08:00:00Z")), false);
    assert.equal(patientCanCancel(VISIT, 12, new Date("2026-10-11T08:00:00Z")), false);
  });

  it("is false for an unreadable visit time", () => {
    assert.equal(patientCanCancel("nope", 24, new Date("2026-10-01T00:00:00Z")), false);
  });
});

describe("professionalCancelIsShortNotice", () => {
  it("warns inside the patient's notice window, not before", () => {
    assert.equal(professionalCancelIsShortNotice(VISIT, 24, new Date("2026-10-08T09:00:00Z")), false);
    assert.equal(professionalCancelIsShortNotice(VISIT, 24, new Date("2026-10-09T12:00:00Z")), true);
  });
});

// The deadline of one visit (lib/visit-cancel-notice). Kept in this file: the unit test
// command in package.json is at the length Windows accepts, so it takes no new file.

const clinics = [
  { clinicId: "clinic-a", cancelNoticeHours: 24 },
  { clinicId: "clinic-b", cancelNoticeHours: 48 },
];

describe("a visit's online cancellation deadline", () => {
  it("is the one the visit was confirmed with, whatever the clinic says today", () => {
    assert.equal(visitCancelNoticeHours({ patient_cancel_notice_hours: 12, clinic_id: "clinic-b" }, clinics), 12);
  });

  it("is the clinic's own for a visit confirmed before deadlines were kept", () => {
    assert.equal(visitCancelNoticeHours({ patient_cancel_notice_hours: null, clinic_id: "clinic-a" }, clinics), 24);
    assert.equal(visitCancelNoticeHours({ clinic_id: "clinic-b" }, clinics), 48);
  });

  it("is 12 hours when neither is known (a clinic she left)", () => {
    assert.equal(visitCancelNoticeHours({ clinic_id: "gone" }, clinics), 12);
    assert.equal(visitCancelNoticeHours({ patient_cancel_notice_hours: 7, clinic_id: null }, []), 12);
  });
});

type Call = { table: string; filters: Record<string, string> };

function fakeService(rows: Record<string, unknown>) {
  const calls: Call[] = [];
  const service = {
    from(table: string) {
      const call: Call = { table, filters: {} };
      calls.push(call);
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          call.filters[column] = value;
          return query;
        },
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
      };
      return query;
    },
  };
  return { service: service as never, calls };
}

describe("loading a visit's deadline on the server", () => {
  it("reads the visit only, when the visit keeps its own", async () => {
    const { service, calls } = fakeService({
      appointments: { professional_id: "pro", clinic_id: "clinic-a", patient_cancel_notice_hours: 48 },
    });
    assert.equal(await loadVisitCancelNoticeHours(service, "visit-1"), 48);
    assert.deepEqual(
      calls.map((c) => c.table),
      ["appointments"],
    );
    assert.equal(calls[0]?.filters.id, "visit-1");
  });

  it("falls back to her limits at that clinic", async () => {
    const { service, calls } = fakeService({
      appointments: { professional_id: "pro", clinic_id: "clinic-a", patient_cancel_notice_hours: null },
      professional_clinics: { patient_cancel_notice_hours: 24 },
    });
    assert.equal(await loadVisitCancelNoticeHours(service, "visit-1"), 24);
    assert.deepEqual(calls[1], {
      table: "professional_clinics",
      filters: { professional_id: "pro", clinic_id: "clinic-a" },
    });
  });

  it("answers 12 hours for a visit that is gone or has no clinic link", async () => {
    assert.equal(await loadVisitCancelNoticeHours(fakeService({}).service, "visit-1"), 12);
    const { service } = fakeService({
      appointments: { professional_id: "pro", clinic_id: "clinic-a", patient_cancel_notice_hours: null },
    });
    assert.equal(await loadVisitCancelNoticeHours(service, "visit-1"), 12);
  });
});
