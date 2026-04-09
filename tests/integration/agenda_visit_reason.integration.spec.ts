import { expect, test } from "@playwright/test";

import { patientVisitReasonFromAppointmentRow } from "@/lib/agenda-visit-reason";

test.describe("Agenda patient visit reason mapping", () => {
  test("reads and trims patient reason from appointments.reason", () => {
    const reason = patientVisitReasonFromAppointmentRow({
      reason: "  Tooth extraction and pain  ",
    });
    expect(reason).toBe("Tooth extraction and pain");
  });

  test("returns null when appointments.reason is empty", () => {
    const reason = patientVisitReasonFromAppointmentRow({ reason: "   " });
    expect(reason).toBeNull();
  });

  test("ignores doctor-flow fields to prevent reason confusion", () => {
    const raw = {
      reason: "Patient reason: recurring migraine",
      rescheduleReason: "Doctor reason: emergency surgery",
      cancelReason: "Doctor reason: unavailable",
    } as unknown as { reason?: unknown };

    const reason = patientVisitReasonFromAppointmentRow(raw);
    expect(reason).toBe("Patient reason: recurring migraine");
    expect(reason).not.toContain("Doctor reason");
  });
});
