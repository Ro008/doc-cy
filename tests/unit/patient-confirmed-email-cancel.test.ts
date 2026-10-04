import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPatientAppointmentConfirmedEmailContent } from "../../lib/send-patient-appointment-confirmed-email";

/**
 * The confirmation email carries the patient's cancel link (user, 2026-10-04): it works
 * until X hours before the visit (the professional's setting).
 */
const base = {
  siteUrl: "https://www.mydoccy.com",
  patientEmail: "maria@example.com",
  patientName: "Maria",
  appointmentId: "appt-1",
  appointmentDatetimeIso: "2026-10-10T07:00:00Z",
  durationMinutes: 30,
  reason: "Check-up",
  doctor: { name: "Dr. Andreas Nikos", specialty: null, phone: "22123456", clinic_address: "Makariou 10" },
};

describe("confirmation email cancel link", () => {
  it("offers the cancel link and says until when", () => {
    const email = buildPatientAppointmentConfirmedEmailContent({
      ...base,
      cancel: { url: "https://www.mydoccy.com/booking/cancel?token=t1", deadlineLabel: "Friday, 9 October at 10:00" },
    });
    for (const body of [email.text, email.html]) {
      assert.ok(body.includes("https://www.mydoccy.com/booking/cancel?token=t1"), "link");
      assert.ok(body.includes("Friday, 9 October at 10:00"), "deadline");
      assert.match(body, /cancel/i);
    }
  });

  it("has no cancel section without a link", () => {
    const email = buildPatientAppointmentConfirmedEmailContent(base);
    assert.ok(!email.text.includes("/booking/cancel"));
    assert.ok(!/Need to cancel/i.test(email.html));
  });
});
