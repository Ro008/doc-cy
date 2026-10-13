import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DoctorSettingsRow } from "../../lib/doctor-settings";
import { settingsToWeeklySlots } from "../../lib/doctor-settings";
import { findFirstAlternativeSlotStarts } from "../../lib/find-alternative-appointment-slots";

/**
 * Free times she can propose. By default the first three after the requested time
 * (pre-filled in the picker); with `onlyDateKey` every free time on that day, so she can
 * swap any of them for another (user, 2026-10-04).
 */
const settings = {
  professional_id: "pro-1",
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
  start_time: "09:00:00",
  end_time: "12:00:00",
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

const base = {
  settings,
  weeklySlots: settingsToWeeklySlots(settings),
  blockingRows: [] as never[],
  fallbackSlotDurationMinutes: 30,
  visitDurationMinutes: 30,
  excludeAppointmentId: "appt-1",
  searchFromAppointmentIso: "2026-10-07T07:00:00Z", // Wed 10:00 Cyprus
  avoidStartIso: "2026-10-07T07:00:00Z",
  nowUtc: new Date("2026-10-05T08:00:00Z"),
};

describe("findFirstAlternativeSlotStarts", () => {
  it("gives the first three free times after the requested one", () => {
    assert.deepEqual(findFirstAlternativeSlotStarts(base), [
      "2026-10-07T07:30:00.000Z",
      "2026-10-07T08:00:00.000Z",
      "2026-10-07T08:30:00.000Z",
    ]);
  });

  it("lists every free time on one day with onlyDateKey", () => {
    const all = findFirstAlternativeSlotStarts({ ...base, onlyDateKey: "2026-10-08", limit: 100 });
    // Thu 09:00-12:00 in 30-min slots: 6 starts.
    assert.equal(all.length, 6);
    assert.equal(all[0], "2026-10-08T06:00:00.000Z");
    assert.equal(all[5], "2026-10-08T08:30:00.000Z");
  });

  // Holiday mode (user, 2026-10-12): the suggested times avoid her holiday, but a day
  // she picks herself lists its times, so she can propose one.
  it("suggests nothing inside her holiday, yet lists a holiday day she picks", () => {
    const onHoliday = {
      ...base,
      settings: {
        ...base.settings,
        holiday_mode_enabled: true,
        holiday_start_date: "2026-10-08",
        holiday_end_date: "2026-10-08",
      },
    };
    const suggested = findFirstAlternativeSlotStarts({ ...onHoliday, limit: 100 });
    assert.ok(suggested.length > 0);
    assert.ok(suggested.every((iso) => !iso.startsWith("2026-10-08")));
    assert.deepEqual(
      findFirstAlternativeSlotStarts({ ...onHoliday, onlyDateKey: "2026-10-08", limit: 100 }),
      findFirstAlternativeSlotStarts({ ...base, onlyDateKey: "2026-10-08", limit: 100 }),
    );
  });

  it("onlyDateKey on a closed day gives nothing", () => {
    assert.deepEqual(findFirstAlternativeSlotStarts({ ...base, onlyDateKey: "2026-10-10", limit: 100 }), []);
  });

  it("onlyDateKey still skips taken times", () => {
    const all = findFirstAlternativeSlotStarts({
      ...base,
      onlyDateKey: "2026-10-08",
      limit: 100,
      blockingRows: [
        { id: "b1", status: "CONFIRMED", appointment_datetime: "2026-10-08T06:30:00Z", duration_minutes: 30 },
      ] as never[],
    });
    assert.equal(all.length, 5);
    assert.ok(!all.includes("2026-10-08T06:30:00.000Z"));
  });
});
