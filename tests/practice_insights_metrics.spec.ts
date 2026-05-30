import { expect, test } from "@playwright/test";
import { buildPracticeInsights } from "@/lib/practice-insights";

test.describe("buildPracticeInsights KPIs", { tag: "@pr-e2e" }, () => {
  test("counts is_new_patient true in current Cyprus month by created_at", () => {
    const now = new Date("2026-05-15T12:00:00Z");
    const rows = [
      {
        appointment_datetime: "2026-05-20T07:00:00.000Z",
        status: "REQUESTED",
        created_at: "2026-05-10T08:00:00.000Z",
        is_new_patient: true,
      },
      {
        appointment_datetime: "2026-05-22T07:00:00.000Z",
        status: "CONFIRMED",
        created_at: "2026-05-12T08:00:00.000Z",
        is_new_patient: true,
      },
      {
        appointment_datetime: "2026-05-18T07:00:00.000Z",
        status: "CONFIRMED",
        created_at: "2026-05-11T08:00:00.000Z",
        is_new_patient: false,
      },
      {
        appointment_datetime: "2026-05-19T07:00:00.000Z",
        status: "CONFIRMED",
        created_at: "2026-04-28T08:00:00.000Z",
        is_new_patient: true,
      },
      {
        appointment_datetime: "2026-05-21T07:00:00.000Z",
        status: "CONFIRMED",
        created_at: "2026-05-13T08:00:00.000Z",
        is_new_patient: null,
      },
    ];

    const insights = buildPracticeInsights(rows, null, now);
    expect(insights.newPatientsCapturedThisMonth).toBe(2);
    expect(insights.totalBookingsThisMonth).toBe(4);
  });

  test("counts no-shows on ended confirmed visits in the appointment month", () => {
    const now = new Date("2026-05-25T18:00:00.000Z");
    const rows = [
      {
        appointment_datetime: "2026-05-10T09:00:00.000Z",
        status: "CONFIRMED",
        created_at: "2026-05-01T08:00:00.000Z",
        duration_minutes: 30,
        attendance: "no_show",
      },
      {
        appointment_datetime: "2026-05-12T11:00:00.000Z",
        status: "CONFIRMED",
        created_at: "2026-05-02T08:00:00.000Z",
        duration_minutes: 30,
        attendance: null,
      },
      {
        appointment_datetime: "2026-05-28T11:00:00.000Z",
        status: "CONFIRMED",
        created_at: "2026-05-20T08:00:00.000Z",
        duration_minutes: 30,
        attendance: "no_show",
      },
    ];

    const insights = buildPracticeInsights(rows, null, now);
    expect(insights.noShowsThisMonth).toBe(1);
    expect(insights.endedConfirmedVisitsThisMonth).toBe(2);
    expect(insights.noShowRatePercent).toBe(50);
  });
});
