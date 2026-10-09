import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APPOINTMENT_ATTENDANCE_ATTENDED,
  APPOINTMENT_ATTENDANCE_NO_SHOW,
  attendanceChangeRefusal,
  normalizeAppointmentAttendance,
  parseAttendanceFromBody,
} from "../../lib/appointment-attendance";

/**
 * Attendance (user, 2026-10-04): the status stays CONFIRMED; the scheduled job sets
 * `attended` 2 h after the visit ends, she can switch to `no_show` (and back) until the
 * review email goes out 24 h after the visit.
 */
const visit = {
  status: "CONFIRMED",
  appointmentIso: "2026-10-05T07:00:00.000Z",
  durationMinutes: 30,
  reviewRequestedAt: null as string | null,
};
const after = new Date("2026-10-05T08:00:00.000Z");

describe("parseAttendanceFromBody", () => {
  it("takes no_show and attended", () => {
    assert.equal(parseAttendanceFromBody("no_show"), APPOINTMENT_ATTENDANCE_NO_SHOW);
    assert.equal(parseAttendanceFromBody("attended"), APPOINTMENT_ATTENDANCE_ATTENDED);
  });

  it("treats a cleared value (the old 'undo no-show') as attended", () => {
    for (const raw of [null, undefined, ""]) {
      assert.equal(parseAttendanceFromBody(raw), APPOINTMENT_ATTENDANCE_ATTENDED, String(raw));
    }
  });

  it("refuses anything else", () => {
    for (const raw of ["late", 1, true, {}]) assert.equal(parseAttendanceFromBody(raw), "invalid");
  });
});

describe("normalizeAppointmentAttendance", () => {
  it("knows both values and nothing else", () => {
    assert.equal(normalizeAppointmentAttendance(" No_Show "), "no_show");
    assert.equal(normalizeAppointmentAttendance("attended"), "attended");
    assert.equal(normalizeAppointmentAttendance("x"), null);
    assert.equal(normalizeAppointmentAttendance(null), null);
  });
});

describe("attendanceChangeRefusal", () => {
  it("allows a confirmed visit that has ended, before the review email", () => {
    assert.equal(attendanceChangeRefusal({ ...visit, now: after }), null);
  });

  it("refuses before the visit has ended", () => {
    assert.equal(
      attendanceChangeRefusal({ ...visit, now: new Date("2026-10-05T07:15:00.000Z") })?.code,
      "not_ended",
    );
  });

  it("refuses rows that aren't confirmed", () => {
    for (const status of ["REQUESTED", "CANCELLED", "DECLINED", "EXPIRED", "NEEDS_RESCHEDULE"]) {
      assert.equal(attendanceChangeRefusal({ ...visit, status, now: after })?.code, "not_confirmed", status);
    }
  });

  it("refuses once the review email has gone out", () => {
    assert.equal(
      attendanceChangeRefusal({ ...visit, reviewRequestedAt: "2026-10-06T07:30:00.000Z", now: after })?.code,
      "review_sent",
    );
  });
});
