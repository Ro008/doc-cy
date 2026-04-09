import { expect, test } from "@playwright/test";
import { zonedTimeToUtc } from "date-fns-tz";

import { CY_TZ } from "@/lib/appointments";
import { buildPatientAppointmentConfirmedEmailContent } from "@/lib/send-patient-appointment-confirmed-email";
import { buildPatientRescheduleProposalEmailContent } from "@/lib/send-patient-reschedule-proposal-email";

function futureCyIso(daysAhead: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const local = `${yyyy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return zonedTimeToUtc(local, CY_TZ).toISOString();
}

test.describe("Critical reschedule email content", () => {
  test("proposal email includes full doctor name + reason + calendar warning for confirmed reschedules", () => {
    const proposalExpiresAtIso = futureCyIso(2, 18, 0);
    const content = buildPatientRescheduleProposalEmailContent({
      siteUrl: "https://mydoccy.com",
      patientEmail: "patient@example.com",
      patientName: "Karina",
      appointmentId: "appt-1",
      rescheduleToken: "token-1",
      proposalExpiresAtIso,
      doctorName: "Andreas Nikos",
      slotLabelsCyprus: ["Thu, 10 Apr 2026 · 14:30", "Thu, 10 Apr 2026 · 15:00"],
      rescheduleReason: "Urgent hospital procedure, I need to move this visit.",
      isFromConfirmedReschedule: true,
    });

    expect(content.subject).toContain("Andreas Nikos suggested new times for your visit");
    expect(content.text).toContain("Reason from Andreas Nikos");
    expect(content.text).toContain("please remove that old calendar entry");
    expect(content.html).toContain("Reason from Andreas Nikos");
    expect(content.html).toContain("please remove that old entry");
  });

  test("proposal email does not include calendar warning when not from confirmed reschedule", () => {
    const proposalExpiresAtIso = futureCyIso(2, 18, 0);
    const content = buildPatientRescheduleProposalEmailContent({
      siteUrl: "https://mydoccy.com",
      patientEmail: "patient@example.com",
      patientName: "Karina",
      appointmentId: "appt-2",
      rescheduleToken: "token-2",
      proposalExpiresAtIso,
      doctorName: "Andreas Nikos",
      slotLabelsCyprus: ["Thu, 10 Apr 2026 · 14:30", "Thu, 10 Apr 2026 · 15:00"],
      isFromConfirmedReschedule: false,
    });

    expect(content.text).not.toContain("remove that old calendar entry");
    expect(content.html).not.toContain("remove that old entry");
  });

  test("confirmation email includes strong reschedule warning and subject when isAfterReschedule", () => {
    const appointmentDatetimeIso = futureCyIso(1, 11, 0);
    const content = buildPatientAppointmentConfirmedEmailContent({
      siteUrl: "https://mydoccy.com",
      patientEmail: "patient@example.com",
      patientName: "Karina",
      appointmentId: "appt-3",
      appointmentDatetimeIso,
      durationMinutes: 30,
      doctor: {
        name: "Andreas Nikos",
        specialty: "Pediatrics",
        phone: "+35799123456",
        clinic_address: "Nicosia",
      },
      isAfterReschedule: true,
    });

    expect(content.subject).toContain("Rescheduled confirmed");
    expect(content.subject).toContain("remove previous calendar event");
    expect(content.text).toContain("IMPORTANT - RESCHEDULED VISIT");
    expect(content.text).toContain("DocCy cannot remove old events");
    expect(content.html).toContain("Appointment re-confirmed (rescheduled)");
    expect(content.html).toContain("Important: this visit was rescheduled");
  });

  test("confirmation email keeps normal subject when not after reschedule", () => {
    const appointmentDatetimeIso = futureCyIso(1, 11, 0);
    const content = buildPatientAppointmentConfirmedEmailContent({
      siteUrl: "https://mydoccy.com",
      patientEmail: "patient@example.com",
      patientName: "Karina",
      appointmentId: "appt-4",
      appointmentDatetimeIso,
      durationMinutes: 30,
      doctor: {
        name: "Andreas Nikos",
        specialty: "Pediatrics",
        phone: "+35799123456",
        clinic_address: "Nicosia",
      },
      isAfterReschedule: false,
    });

    expect(content.subject).toContain("Confirmed — Andreas Nikos");
    expect(content.subject).not.toContain("Rescheduled confirmed");
    expect(content.text).not.toContain("IMPORTANT - RESCHEDULED VISIT");
    expect(content.html).not.toContain("Appointment re-confirmed (rescheduled)");
  });
});
