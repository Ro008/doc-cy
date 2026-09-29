import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RESCHEDULE_REMINDER_LEAD_HOURS,
  buildDoctorPatientAskedOtherTimeEmailContent,
  buildPatientRescheduleExpiredEmailContent,
  buildPatientRescheduleReminderEmailContent,
  isRescheduleReminderDue,
} from "../../lib/reschedule-emails";

const SITE = "https://www.mydoccy.com";
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

describe("buildPatientRescheduleReminderEmailContent", () => {
  const content = buildPatientRescheduleReminderEmailContent({
    siteUrl: SITE,
    patientName: "Anastasia",
    appointmentId: "appt-1",
    rescheduleToken: "tok-1",
    proposalExpiresAtIso: "2026-09-30T09:28:00.000Z",
    doctorName: "Monica Geller",
    slotLabelsCyprus: ["Thursday, 1 October 2026 at 09:30"],
  });

  it("says who, the deadline in Cyprus time, and links to the same pick page", () => {
    assert.match(content.subject, /Monica Geller/);
    assert.match(content.text, /Wednesday, 30 September 2026 at 12:28/);
    assert.match(content.text, /https:\/\/www\.mydoccy\.com\/reschedule\/appt-1\?token=tok-1/);
    assert.match(content.html, /Choose a time/);
  });

  it("mentions that any other free time can be picked from the link", () => {
    assert.match(content.text, /any other free time/i);
  });
});

describe("buildPatientRescheduleExpiredEmailContent", () => {
  const content = buildPatientRescheduleExpiredEmailContent({
    siteUrl: SITE,
    patientName: "Anastasia <b>",
    doctorName: "Monica Geller",
    doctorSlug: "monica-geller",
    originalAppointmentIso: "2026-09-29T12:00:00.000Z",
  });

  it("says the visit is no longer booked and points at online booking on the profile", () => {
    assert.match(content.subject, /no longer booked/i);
    assert.match(content.text, /Tuesday, 29 September 2026 at 15:00/);
    assert.match(content.text, /https:\/\/www\.mydoccy\.com\/en\/monica-geller/);
    assert.match(content.html, /Book a new time online/);
  });

  it("never pushes the patient to call", () => {
    assert.doesNotMatch(content.text, /call|phone/i);
    assert.doesNotMatch(content.html, /call|phone|tel:/i);
  });

  it("escapes names in the HTML", () => {
    assert.doesNotMatch(content.html, /Anastasia <b>/);
    assert.match(content.html, /Anastasia &lt;b&gt;/);
  });
});

describe("buildDoctorPatientAskedOtherTimeEmailContent", () => {
  const content = buildDoctorPatientAskedOtherTimeEmailContent({
    siteUrl: SITE,
    doctorName: "Monica Geller",
    patientName: "Anastasia",
    appointmentId: "appt-1",
    requestedIso: "2026-10-05T06:30:00.000Z",
    previousIso: "2026-09-29T12:00:00.000Z",
  });

  it("tells the doctor the new time, the old one, and links to the review page", () => {
    assert.match(content.subject, /Anastasia asked for another time/);
    assert.match(content.text, /Monday, 5 October 2026 at 09:30/);
    assert.match(content.text, /Tuesday, 29 September 2026 at 15:00/);
    assert.match(content.text, /https:\/\/www\.mydoccy\.com\/dashboard\/appointments\/appt-1/);
    assert.match(content.html, /Review request/);
  });
});
