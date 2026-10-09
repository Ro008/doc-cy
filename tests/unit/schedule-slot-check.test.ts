import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DoctorSettingsRow } from "../../lib/doctor-settings";
import { scheduleSlotRefusal } from "../../lib/schedule-slot-check";

/**
 * Whether one start time fits the clinic's schedule and the professional's agenda:
 * holiday, horizon, minimum notice, opening hours, slot grid, overlap (any clinic).
 * Shared by online booking and by the times she proposes (user, 2026-10-04: proposals
 * only inside opening hours).
 */
const NOW = new Date("2026-10-05T08:00:00Z"); // Monday 11:00 Cyprus

const settings: DoctorSettingsRow = {
  professional_id: "pro-1",
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
  start_time: "09:00:00",
  end_time: "17:00:00",
  weekly_schedule: null,
  break_start: null,
  break_end: null,
  pause_online_bookings: false,
  holiday_mode_enabled: false,
  holiday_start_date: null,
  holiday_end_date: null,
  booking_horizon_days: 90,
  minimum_notice_hours: 2,
  slot_duration_minutes: 30,
} as DoctorSettingsRow;

const at = (iso: string) => new Date(iso);

describe("scheduleSlotRefusal", () => {
  it("accepts a free time inside the hours", () => {
    assert.equal(
      scheduleSlotRefusal({ settingsRow: settings, appointmentUtc: at("2026-10-07T07:00:00Z"), durationMinutes: 30, blockingRows: [], now: NOW }),
      null,
    );
  });

  for (const [label, iso, code] of [
    ["outside the hours", "2026-10-07T15:00:00Z", "outside_hours"], // 18:00 Cyprus
    ["a closed day", "2026-10-10T07:00:00Z", "outside_hours"], // Saturday
    ["off the slot grid", "2026-10-07T07:10:00Z", "not_aligned"],
    ["inside the minimum notice", "2026-10-05T09:00:00Z", "minimum_notice"],
    ["beyond the horizon", "2027-02-01T08:00:00Z", "beyond_horizon"],
  ] as const) {
    it(`refuses a time ${label}`, () => {
      const refusal = scheduleSlotRefusal({
        settingsRow: settings,
        appointmentUtc: at(iso),
        durationMinutes: 30,
        blockingRows: [],
        now: NOW,
      });
      assert.equal(refusal?.code, code);
    });
  }

  it("refuses a time another visit covers, but not the visit being moved", () => {
    const rows = [
      { id: "a1", status: "CONFIRMED", appointment_datetime: "2026-10-07T07:00:00Z", duration_minutes: 30 },
    ];
    const base = { settingsRow: settings, appointmentUtc: at("2026-10-07T07:00:00Z"), durationMinutes: 30, blockingRows: rows, now: NOW };
    assert.equal(scheduleSlotRefusal(base)?.code, "slot_taken");
    assert.equal(scheduleSlotRefusal({ ...base, excludeAppointmentId: "a1" }), null);
  });

  it("checks the whole visit length against later visits", () => {
    const rows = [
      { id: "a1", status: "CONFIRMED", appointment_datetime: "2026-10-07T07:30:00Z", duration_minutes: 30 },
    ];
    const refusal = scheduleSlotRefusal({
      settingsRow: settings,
      appointmentUtc: at("2026-10-07T07:00:00Z"),
      durationMinutes: 60,
      blockingRows: rows,
      now: NOW,
    });
    assert.equal(refusal?.code, "slot_taken");
  });

  it("refuses a day inside her holiday", () => {
    const refusal = scheduleSlotRefusal({
      settingsRow: { ...settings, holiday_mode_enabled: true, holiday_start_date: "2026-10-06", holiday_end_date: "2026-10-08" },
      appointmentUtc: at("2026-10-07T07:00:00Z"),
      durationMinutes: 30,
      blockingRows: [],
      now: NOW,
    });
    assert.equal(refusal?.code, "holiday");
  });
});
