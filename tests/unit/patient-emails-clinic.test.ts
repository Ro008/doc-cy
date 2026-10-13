import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBookingConfirmLinkEmail } from "../../lib/booking-request-emails";
import { buildPatientRequestExpiredEmail, buildPatientVisitReminderEmail } from "../../lib/appointment-job-emails";
import { buildPatientReviewRequestEmail } from "../../lib/review-request-email";
import { buildPatientRescheduleReminderEmailContent } from "../../lib/reschedule-emails";
import { buildPatientRescheduleProposalEmailContent } from "../../lib/send-patient-reschedule-proposal-email";
import { buildPatientAppointmentConfirmedEmailContent } from "../../lib/send-patient-appointment-confirmed-email";
import { buildPatientRequestDeclinedEmailContent } from "../../lib/send-patient-request-declined-email";
import { buildPatientConfirmedAppointmentCancelledEmailContent } from "../../lib/send-patient-confirmed-appointment-cancelled-email";

/**
 * Every email to a patient carries the clinic (user, 2026-10-07): its name linking to the
 * professional's profile, its address linking to the Maps pin, its phone with +357 linking to call.
 */
const PROFILE = "https://www.mydoccy.com/en/maria-merakli";
const MAPS = "https://maps.app.goo.gl/abc123";
const CLINIC = {
  name: "Maria Orthodontics",
  address: "Spyrou Kyprianou 81, Larnaka 6051, Cyprus",
  mapsUrl: MAPS,
  phone: "22123123",
  profileUrl: PROFILE,
};
const ISO = "2026-10-22T08:00:00.000Z";

function assertClinicBlock(email: { text: string; html: string }) {
  // HTML: three links.
  assert.ok(email.html.includes(`href="${PROFILE}"`), "profile link");
  assert.match(email.html, /<strong>Maria Orthodontics<\/strong>/);
  assert.ok(email.html.includes(`href="${MAPS}"`), "maps link");
  assert.match(email.html, /<a href="tel:\+35722123123"[^>]*>\+357 22 123123<\/a>/);
  // Plain text: all three as readable lines.
  assert.match(email.text, /Clinic: Maria Orthodontics/);
  assert.ok(email.text.includes(PROFILE));
  assert.ok(email.text.includes(MAPS));
  assert.match(email.text, /Phone: \+357 22 123123/);
}

describe("clinic block in the patient emails", () => {
  it("confirm your request", () => {
    assertClinicBlock(
      buildBookingConfirmLinkEmail({
        patientName: "Ana",
        professionalName: "Dr Maria Merakli",
        appointmentIso: ISO,
        clinic: CLINIC,
        confirmUrl: "https://www.mydoccy.com/booking/confirm?token=x",
      }),
    );
  });

  it("request not booked (nobody replied)", () => {
    assertClinicBlock(
      buildPatientRequestExpiredEmail({
        patientName: "Ana",
        professionalName: "Dr Maria Merakli",
        appointmentIso: ISO,
        bookUrl: PROFILE,
        clinic: CLINIC,
      }),
    );
  });

  it("visit reminder", () => {
    assertClinicBlock(
      buildPatientVisitReminderEmail({
        patientName: "Ana",
        professionalName: "Dr Maria Merakli",
        appointmentIso: ISO,
        clinic: CLINIC,
        cancel: null,
      }),
    );
  });

  it("review request", () => {
    assertClinicBlock(
      buildPatientReviewRequestEmail({
        patientName: "Ana K",
        professionalName: "Dr Maria Merakli",
        appointmentIso: ISO,
        reviewUrl: "https://www.mydoccy.com/booking/review?token=x",
        clinic: CLINIC,
      }),
    );
  });

  it("proposal reminder", () => {
    assertClinicBlock(
      buildPatientRescheduleReminderEmailContent({
        patientName: "Ana",
        chooseUrl: "https://www.mydoccy.com/booking/choose?token=x",
        proposalExpiresAtIso: ISO,
        doctorName: "Dr Maria Merakli",
        slotLabelsCyprus: ["Fri 9 Oct, 12:30"],
        clinic: CLINIC,
      }),
    );
  });

  it("proposed times", () => {
    assertClinicBlock(
      buildPatientRescheduleProposalEmailContent({
        patientName: "Ana",
        chooseUrl: "https://www.mydoccy.com/booking/choose?token=x",
        proposalExpiresAtIso: ISO,
        doctorName: "Dr Maria Merakli",
        slotLabelsCyprus: ["Friday, 9 October 2026 at 12:30"],
        clinic: CLINIC,
      }),
    );
  });

  it("appointment confirmed", () => {
    assertClinicBlock(
      buildPatientAppointmentConfirmedEmailContent({
        siteUrl: "https://www.mydoccy.com",
        patientEmail: "ana@example.com",
        patientName: "Ana",
        appointmentId: "a1",
        appointmentDatetimeIso: ISO,
        durationMinutes: 30,
        doctor: { name: "Dr Maria Merakli", phone: "22123123", clinic_address: CLINIC.address },
        clinic: { clinicName: CLINIC.name, address: CLINIC.address, mapsUrl: MAPS },
        profileUrl: PROFILE,
      }),
    );
  });

  it("request declined", () => {
    assertClinicBlock(
      buildPatientRequestDeclinedEmailContent({
        siteUrl: "https://www.mydoccy.com",
        patientName: "Ana",
        doctorName: "Dr Maria Merakli",
        doctorSlug: "maria-merakli",
        declineReason: "I am away that week, sorry.",
        clinic: CLINIC,
      }),
    );
  });

  it("visit cancelled by the professional", () => {
    assertClinicBlock(
      buildPatientConfirmedAppointmentCancelledEmailContent({
        siteUrl: "https://www.mydoccy.com",
        patientName: "Ana",
        doctorName: "Dr Maria Merakli",
        doctorSlug: "maria-merakli",
        appointmentDatetimeIso: ISO,
        cancelReason: "The clinic is closed that day.",
        clinic: CLINIC,
      }),
    );
  });

  it("emails still build without a clinic", () => {
    const declined = buildPatientRequestDeclinedEmailContent({
      siteUrl: "https://www.mydoccy.com",
      patientName: "Ana",
      doctorName: "Dr Maria Merakli",
      doctorSlug: "maria-merakli",
      declineReason: "I am away that week, sorry.",
    });
    assert.equal(declined.html.includes("tel:"), false);
    const expired = buildPatientRequestExpiredEmail({
      patientName: "Ana",
      professionalName: "Dr Maria Merakli",
      appointmentIso: ISO,
      bookUrl: null,
    });
    assert.equal(expired.text.includes("Clinic:"), false);
  });
});
