import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ATTENDED_AFTER_END_HOURS,
  EMAIL_BACKLOG_DAYS,
  REVIEW_AFTER_END_HOURS,
  VISIT_REMINDER_HOURS,
  isAttendedDue,
  isReviewRequestDue,
  isVisitReminderDue,
} from "../../lib/appointments-job";
import { buildPatientRequestExpiredEmail, buildPatientVisitReminderEmail } from "../../lib/appointment-job-emails";

/**
 * The scheduled job (user, 2026-10-04), every 15 minutes:
 * unanswered request past its time → EXPIRED + patient email; lapsed proposal → EXPIRED
 * quietly (reminder 3 h before); visit reminder ~24 h before; attended 2 h after the visit
 * ends; review email 24 h after it ends; purge old drafts.
 */
const H = 60 * 60 * 1000;
const now = new Date("2026-10-10T09:00:00.000Z");
const iso = (offsetHours: number) => new Date(now.getTime() + offsetHours * H).toISOString();

describe("constants", () => {
  it("match the decisions", () => {
    assert.equal(VISIT_REMINDER_HOURS, 24);
    assert.equal(ATTENDED_AFTER_END_HOURS, 2);
    assert.equal(REVIEW_AFTER_END_HOURS, 24);
    assert.equal(EMAIL_BACKLOG_DAYS, 7);
  });
});

describe("isVisitReminderDue", () => {
  it("is due once the visit is within 24 h", () => {
    assert.equal(isVisitReminderDue({ startIso: iso(23), createdIso: iso(-72), now }), true);
    assert.equal(isVisitReminderDue({ startIso: iso(25), createdIso: iso(-72), now }), false);
  });

  it("skips visits that already started", () => {
    assert.equal(isVisitReminderDue({ startIso: iso(-1), createdIso: iso(-72), now }), false);
  });

  it("skips visits booked less than 24 h before they start (they just booked)", () => {
    assert.equal(isVisitReminderDue({ startIso: iso(10), createdIso: iso(-2), now }), false);
  });
});

describe("isAttendedDue", () => {
  it("is due 2 h after the visit ends", () => {
    // 30-min visit that started 2.5 h ago ended 2 h ago.
    assert.equal(isAttendedDue({ startIso: iso(-2.5), durationMinutes: 30, now }), true);
    assert.equal(isAttendedDue({ startIso: iso(-2.4), durationMinutes: 30, now }), false);
  });

  it("uses 30 minutes when the length is unknown", () => {
    assert.equal(isAttendedDue({ startIso: iso(-2.5), durationMinutes: null, now }), true);
  });
});

describe("isReviewRequestDue", () => {
  it("is due 24 h after the visit ends", () => {
    assert.equal(isReviewRequestDue({ startIso: iso(-24.5), durationMinutes: 30, now }), true);
    assert.equal(isReviewRequestDue({ startIso: iso(-24.4), durationMinutes: 30, now }), false);
  });

  it("doesn't email about visits older than the backlog window", () => {
    assert.equal(isReviewRequestDue({ startIso: iso(-8 * 24), durationMinutes: 30, now }), false);
  });
});

describe("buildPatientRequestExpiredEmail", () => {
  const email = buildPatientRequestExpiredEmail({
    patientName: "Maria Kyriakou",
    professionalName: "Dr. Andreas Nikos",
    appointmentIso: "2026-10-07T07:00:00Z",
    bookUrl: "https://www.mydoccy.com/doctors/andreas-nikos",
  });

  it("says the professional couldn't reply in time, with the book-again link", () => {
    assert.ok(email.subject.includes("Andreas"));
    for (const body of [email.text, email.html]) {
      assert.ok(body.includes("Maria"));
      assert.ok(body.includes("Wednesday, 7 October 2026"));
      assert.ok(body.includes("10:00"));
      assert.ok(body.includes("https://www.mydoccy.com/doctors/andreas-nikos"));
    }
    assert.match(email.text, /couldn.t reply in time/);
  });
});

describe("buildPatientVisitReminderEmail", () => {
  const base = {
    patientName: "Maria Kyriakou",
    professionalName: "Dr. Andreas Nikos",
    appointmentIso: "2026-10-07T07:00:00Z",
    clinic: { name: "Evangelismos", address: "Makariou 10, Nicosia" },
  };

  it("reminds of the time and place, with the cancel link while it's open", () => {
    const email = buildPatientVisitReminderEmail({
      ...base,
      cancel: { url: "https://www.mydoccy.com/booking/cancel?token=abc", deadlineLabel: "Tuesday, 6 October 2026 at 10:00" },
    });
    assert.match(email.subject, /reminder/i);
    for (const body of [email.text, email.html]) {
      assert.ok(body.includes("Wednesday, 7 October 2026"));
      assert.ok(body.includes("10:00"));
      assert.ok(body.includes("Evangelismos"));
      assert.ok(body.includes("https://www.mydoccy.com/booking/cancel?token=abc"));
    }
  });

  it("leaves the cancel link out when there is none", () => {
    const email = buildPatientVisitReminderEmail({ ...base, cancel: null });
    assert.ok(!email.text.includes("/booking/cancel"));
  });
});
