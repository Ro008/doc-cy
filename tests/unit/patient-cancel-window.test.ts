import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
