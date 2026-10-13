import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RESCHEDULE_REMINDER_LEAD_HOURS,
  buildPatientRescheduleReminderEmailContent,
  isRescheduleReminderDue,
} from "../../lib/reschedule-emails";

const HOUR = 60 * 60 * 1000;

describe("isRescheduleReminderDue", () => {
  const expires = "2026-09-30T09:00:00.000Z";
  const expMs = new Date(expires).getTime();

  it("reminds once, in the last hours before the deadline", () => {
    assert.equal(RESCHEDULE_REMINDER_LEAD_HOURS, 3);
    assert.equal(isRescheduleReminderDue({ nowMs: expMs - 2 * HOUR, proposalExpiresAtIso: expires, reminderSentAtIso: null }), true);
  });

  it("is not due too early", () => {
    assert.equal(isRescheduleReminderDue({ nowMs: expMs - 5 * HOUR, proposalExpiresAtIso: expires, reminderSentAtIso: null }), false);
  });

  it("is not due after the deadline or when already sent", () => {
    assert.equal(isRescheduleReminderDue({ nowMs: expMs + HOUR, proposalExpiresAtIso: expires, reminderSentAtIso: null }), false);
    assert.equal(
      isRescheduleReminderDue({ nowMs: expMs - HOUR, proposalExpiresAtIso: expires, reminderSentAtIso: "2026-09-30T06:30:00.000Z" }),
      false,
    );
  });

  it("is not due without a deadline", () => {
    assert.equal(isRescheduleReminderDue({ nowMs: expMs, proposalExpiresAtIso: null, reminderSentAtIso: null }), false);
  });
});

// The only reschedule email left (user, 2026-10-04): a reminder 3 h before the proposal
// lapses. No "expired" email and no "asked for another time": no ping-pong.
describe("buildPatientRescheduleReminderEmailContent", () => {
  const content = buildPatientRescheduleReminderEmailContent({
    patientName: "Anastasia",
    chooseUrl: "https://www.mydoccy.com/booking/choose?token=tok-1",
    proposalExpiresAtIso: "2026-09-30T09:28:00.000Z",
    doctorName: "Monica Geller",
    slotLabelsCyprus: ["Thursday, 1 October 2026 at 09:30"],
  });

  it("says who, the deadline in Cyprus time, and links to the pick page", () => {
    assert.match(content.subject, /Monica Geller/);
    assert.match(content.text, /Wednesday, 30 September 2026 at 12:28/);
    assert.ok(content.text.includes("https://www.mydoccy.com/booking/choose?token=tok-1"));
    assert.ok(content.html.includes("https://www.mydoccy.com/booking/choose?token=tok-1"));
  });

  it("says the times are released, and offers no other time", () => {
    assert.match(content.text, /released/i);
    assert.doesNotMatch(content.text, /any other free time/i);
  });
});
