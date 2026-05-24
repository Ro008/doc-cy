import { expect, test } from "@playwright/test";
import { zonedTimeToUtc } from "date-fns-tz";

import { CY_TZ } from "@/lib/appointments";
import {
  buildMonthlyDigestMetrics,
  cyprusMonthReferenceFromKey,
  monthlyDigestHasActivity,
} from "@/lib/monthly-digest-metrics";
import { buildDoctorMonthlyDigestEmailContent } from "@/lib/send-doctor-monthly-digest-email";

function cyIso(monthKey: string, day: number, hour: number, minute = 0): string {
  const dd = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return zonedTimeToUtc(`${monthKey}-${dd}T${hh}:${mm}:00`, CY_TZ).toISOString();
}

test.describe("Monthly digest (month-end effect)", () => {
  test("metrics count confirmed bookings and closed-hour visits for the report month", () => {
    const monthKey = "2026-04";
    const reportMonth = cyprusMonthReferenceFromKey(monthKey);

    const metrics = buildMonthlyDigestMetrics(
      [
        {
          appointment_datetime: cyIso(monthKey, 12, 20),
          status: "CONFIRMED",
          created_at: cyIso(monthKey, 5, 10),
        },
        {
          appointment_datetime: cyIso(monthKey, 15, 11),
          status: "CONFIRMED",
          created_at: cyIso(monthKey, 14, 9),
        },
        {
          appointment_datetime: cyIso(monthKey, 20, 19),
          status: "REQUESTED",
          created_at: cyIso(monthKey, 20, 18),
        },
        {
          appointment_datetime: cyIso("2026-03", 28, 20),
          status: "CONFIRMED",
          created_at: cyIso("2026-03", 28, 19),
        },
      ],
      null,
      reportMonth,
    );

    expect(metrics.monthKey).toBe("2026-04");
    expect(metrics.confirmedThisMonth).toBe(2);
    expect(metrics.phoneTimeSavedHours).toBe(0.1);
    expect(metrics.closedHoursAppointmentsCount).toBe(1);
    expect(monthlyDigestHasActivity(metrics)).toBe(true);
  });

  test("email uses short copy with hours, closed-hour appointments, and insights link", () => {
    const content = buildDoctorMonthlyDigestEmailContent({
      siteUrl: "https://www.mydoccy.com",
      doctorName: "Dr Andreas Nikos",
      metrics: {
        monthKey: "2026-04",
        monthLabel: "April 2026",
        phoneTimeSavedHours: 2.5,
        closedHoursAppointmentsCount: 3,
        confirmedThisMonth: 38,
      },
    });

    expect(content.subject).toContain("April 2026");
    expect(content.text).toContain("Hi Andreas, in April 2026 DocCy saved your staff 2.5 hours of phone calls");
    expect(content.text).toContain("secured 3 appointments during hours your clinic was closed");
    expect(content.text).toContain("https://www.mydoccy.com/login?next=%2Fagenda%2Finsights");
    expect(content.html).toContain("See your full report here");
  });
});
