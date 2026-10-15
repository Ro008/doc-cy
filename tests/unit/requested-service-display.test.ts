import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { visitPurpose } from "../../lib/visit-purpose";
import {
  buildBookingConfirmLinkEmail,
  buildProfessionalNewRequestEmail,
} from "../../lib/booking-request-emails";
import { getCalendarEventDetails } from "../../lib/patient-calendar-event";
import { getDoctorCalendarEventDetails } from "../../lib/doctor-calendar-event";
import { buildPatientAppointmentConfirmedEmailContent } from "../../lib/send-patient-appointment-confirmed-email";

/**
 * The service the patient picked when booking (user, 2026-10-09) is shown wherever the
 * request is: the dashboard card, the review page, the emails and the calendar invite.
 * A picked service is also sent as the reason (the database requires one), so the reason
 * is left out when it only repeats the service name.
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

const clinic = { name: "Evangelismos", address: "Makariou 10, Nicosia", phone: "22123456" };
const doctor = {
  name: "Dr. Andreas Nikos",
  specialty: null,
  phone: "22123456",
  clinic_name: "Evangelismos",
  clinic_address: "Makariou 10",
};
const appt = { id: "appt-1", appointment_datetime: "2026-10-10T07:00:00Z" };

describe("visitPurpose", () => {
  it("shows the service and drops a reason that only repeats it", () => {
    assert.deepEqual(visitPurpose({ serviceName: "Heart check-up", reason: "Heart check-up" }), {
      service: "Heart check-up",
      reason: null,
    });
    assert.deepEqual(visitPurpose({ serviceName: "ECG", reason: " ecg " }), { service: "ECG", reason: null });
  });

  it("keeps a reason of its own", () => {
    assert.deepEqual(visitPurpose({ serviceName: "ECG", reason: "Chest pain since Monday" }), {
      service: "ECG",
      reason: "Chest pain since Monday",
    });
  });

  it("no service: the reason as before", () => {
    assert.deepEqual(visitPurpose({ serviceName: null, reason: "Knee pain" }), { service: null, reason: "Knee pain" });
    assert.deepEqual(visitPurpose({ reason: "  " }), { service: null, reason: null });
  });
});

describe("emails name the service", () => {
  it("the patient's confirm-your-request email", () => {
    const email = buildBookingConfirmLinkEmail({
      patientName: "Maria Kyriakou",
      professionalName: "Dr. Andreas Nikos",
      appointmentIso: "2026-10-07T07:00:00Z",
      clinic,
      confirmUrl: "https://www.mydoccy.com/booking/confirm?token=abc",
      serviceName: "Heart check-up",
    });
    assert.match(email.text, /Service: Heart check-up/);
    assert.match(email.html, /Service:<\/strong> Heart check-up/);
    const none = buildBookingConfirmLinkEmail({
      patientName: "Maria Kyriakou",
      professionalName: "Dr. Andreas Nikos",
      appointmentIso: "2026-10-07T07:00:00Z",
      clinic,
      confirmUrl: "https://x.test/c",
    });
    assert.ok(!none.text.includes("Service:"));
  });

  it("the professional's new-request email: service, and the reason only when it says more", () => {
    const same = buildProfessionalNewRequestEmail({
      professionalName: "Dr. Andreas Nikos",
      patientName: "Maria Kyriakou",
      appointmentIso: "2026-10-07T07:00:00Z",
      reason: "Heart check-up",
      serviceName: "Heart check-up",
      isNewPatient: true,
      clinic,
      reviewUrl: "https://www.mydoccy.com/dashboard/appointments/appt-1",
    });
    assert.match(same.text, /Service: Heart check-up/);
    assert.ok(!same.text.includes("Reason:"));
    assert.match(same.html, /Service:<\/strong> Heart check-up/);

    const own = buildProfessionalNewRequestEmail({
      professionalName: "Dr. Andreas Nikos",
      patientName: "Maria Kyriakou",
      appointmentIso: "2026-10-07T07:00:00Z",
      reason: "Knee pain",
      serviceName: null,
      isNewPatient: false,
      clinic,
      reviewUrl: "https://x.test/r",
    });
    assert.match(own.text, /Reason: Knee pain/);
    assert.ok(!own.text.includes("Service:"));
  });

  it("the patient's confirmation email", () => {
    const email = buildPatientAppointmentConfirmedEmailContent({
      siteUrl: "https://www.mydoccy.com",
      patientEmail: "maria@example.com",
      patientName: "Maria",
      appointmentId: "appt-1",
      appointmentDatetimeIso: "2026-10-10T07:00:00Z",
      durationMinutes: 30,
      reason: "Heart check-up",
      serviceName: "Heart check-up",
      doctor: { name: "Dr. Andreas Nikos", specialty: null, phone: "22123456", clinic_address: "Makariou 10" },
    });
    assert.match(email.text, /Service: Heart check-up/);
    assert.match(email.html, /Service:<\/strong> Heart check-up/);
  });
});

describe("calendar invites name the service", () => {
  it("patient's event", () => {
    const { description } = getCalendarEventDetails(appt, doctor, {
      serviceName: "Heart check-up",
      reason: "Heart check-up",
    });
    assert.match(description, /^Service: Heart check-up$/m);
    assert.ok(!description.includes("Reason:"));
  });

  it("professional's event keeps the patient's own words too", () => {
    const { description } = getDoctorCalendarEventDetails(
      { patient_name: "Maria", patient_phone: null },
      doctor,
      { serviceName: "ECG", reason: "Chest pain" },
    );
    assert.match(description, /^Service: ECG$/m);
    assert.match(description, /^Reason: Chest pain$/m);
  });
});

describe("screens and links load and pass the service", () => {
  it("the dashboard request card and the agenda's visit details", () => {
    assert.match(read("lib/doctor-dashboard.ts"), /DASHBOARD_APPOINTMENT_SELECT =[\s\S]*?service_name/);
    assert.match(read("lib/agenda-clinics.ts"), /AGENDA_APPOINTMENT_SELECT =[\s\S]*?service_name/);
    assert.match(read("components/dashboard/DoctorDashboard.tsx"), /visitPurpose\(/);
    assert.match(read("components/agenda/VisitDetailsDialog.tsx"), /visitPurpose\(/);
  });

  it("the review page", () => {
    const page = read("app/dashboard/appointments/[id]/page.tsx");
    assert.match(page, /service_name/);
    assert.match(page, /visitPurpose\(/);
    assert.match(read("components/dashboard/AppointmentReviewClient.tsx"), /serviceName/);
  });

  it("every email and calendar link is given the service", () => {
    assert.match(read("app/api/appointments/route.ts"), /serviceName: professionalServiceName/);
    assert.match(read("app/api/booking/confirm/route.ts"), /serviceName: draft\.service_name/);
    for (const file of [
      "app/api/appointments/[id]/confirm/route.ts",
      "app/api/appointments/[id]/calendar/route.ts",
      "lib/patient-proposal.ts",
      "lib/public/booking-success-page.tsx",
      "lib/appointments-job.ts",
    ]) {
      assert.match(read(file), /service_name/, file);
    }
  });
});
