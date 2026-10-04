import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBookingConfirmLinkEmail,
  buildProfessionalNewRequestEmail,
  buildProfessionalPatientCancelledEmail,
} from "../../lib/booking-request-emails";

const clinic = { name: "Evangelismos", address: "Makariou 10, Nicosia", phone: "22123456" };

describe("buildBookingConfirmLinkEmail (to the patient, right after submit)", () => {
  const email = buildBookingConfirmLinkEmail({
    patientName: "Maria Kyriakou",
    professionalName: "Dr. Andreas Nikos",
    appointmentIso: "2026-10-07T07:00:00Z",
    clinic,
    confirmUrl: "https://www.mydoccy.com/booking/confirm?token=abc",
  });

  it("asks to confirm the request, with the link", () => {
    assert.match(email.subject, /confirm/i);
    assert.ok(email.text.includes("https://www.mydoccy.com/booking/confirm?token=abc"));
    assert.ok(email.html.includes("https://www.mydoccy.com/booking/confirm?token=abc"));
  });

  it("names the professional, the time (Cyprus) and the clinic", () => {
    for (const body of [email.text, email.html]) {
      assert.ok(body.includes("Andreas"), "professional");
      assert.ok(body.includes("Wednesday, 7 October 2026"), "date");
      assert.ok(body.includes("10:00"), "Cyprus time");
      assert.ok(body.includes("Evangelismos"), "clinic name");
    }
  });

  it("says the link lasts 30 minutes and nothing is sent until they confirm", () => {
    assert.match(email.text, /30 minutes/);
    assert.match(email.text, /not .*sent|until you confirm/i);
  });

  it("greets by first name and escapes HTML", () => {
    const evil = buildBookingConfirmLinkEmail({
      patientName: "<b>Eve</b> X",
      professionalName: "Dr. A",
      appointmentIso: "2026-10-07T07:00:00Z",
      clinic,
      confirmUrl: "https://x.test/booking/confirm?token=t",
    });
    assert.ok(!evil.html.includes("<b>Eve</b>"));
    assert.ok(email.text.startsWith("Hi Maria,"));
  });
});

describe("buildProfessionalNewRequestEmail (to her, once the patient confirmed)", () => {
  const email = buildProfessionalNewRequestEmail({
    professionalName: "Dr. Andreas Nikos",
    patientName: "Maria Kyriakou",
    appointmentIso: "2026-10-07T07:00:00Z",
    reason: "Knee pain",
    isNewPatient: true,
    clinic,
    reviewUrl: "https://www.mydoccy.com/dashboard/appointments/appt-1",
  });

  it("links straight to the request's review page", () => {
    assert.ok(email.text.includes("https://www.mydoccy.com/dashboard/appointments/appt-1"));
    assert.ok(email.html.includes("https://www.mydoccy.com/dashboard/appointments/appt-1"));
  });

  it("says who, when, where, why and whether it is a first visit", () => {
    assert.match(email.subject, /Maria Kyriakou/);
    for (const body of [email.text, email.html]) {
      assert.ok(body.includes("Maria Kyriakou"));
      assert.ok(body.includes("Wednesday, 7 October 2026"));
      assert.ok(body.includes("10:00"));
      assert.ok(body.includes("Evangelismos"));
      assert.ok(body.includes("Knee pain"));
      assert.match(body, /first visit/i);
    }
  });
});

describe("buildProfessionalPatientCancelledEmail (to her, when the patient cancels)", () => {
  const email = buildProfessionalPatientCancelledEmail({
    professionalName: "Dr. Andreas Nikos",
    patientName: "Maria Kyriakou",
    appointmentIso: "2026-10-07T07:00:00Z",
    clinic,
    cancelReason: "I feel better now",
    agendaUrl: "https://www.mydoccy.com/agenda",
  });

  it("says who cancelled which visit, and that the time is free again", () => {
    assert.match(email.subject, /cancel/i);
    assert.match(email.subject, /Maria Kyriakou/);
    for (const body of [email.text, email.html]) {
      assert.ok(body.includes("Wednesday, 7 October 2026"));
      assert.ok(body.includes("10:00"));
      assert.ok(body.includes("Evangelismos"));
      assert.ok(body.includes("I feel better now"));
      assert.match(body, /free again|available again/i);
    }
  });

  it("leaves out the reason line when there is none", () => {
    const bare = buildProfessionalPatientCancelledEmail({
      professionalName: "Dr. A",
      patientName: "P Q",
      appointmentIso: "2026-10-07T07:00:00Z",
      clinic,
      cancelReason: null,
      agendaUrl: "https://x.test/agenda",
    });
    assert.ok(!/Their message/i.test(bare.text));
  });
});
