import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { workingWindowForHours, type AgendaWorkingHours } from "../../lib/agenda-clinics";
import { getScheduleOverlapWarning } from "../../lib/appointment-review-schedule-warn";
import { clinicHoursProblem, clinicHoursProblems, defaultDayBreak } from "../../lib/clinic-hours-check";
import { locationScheduleColumns } from "../../lib/doctor-locations";
import {
  buildWeeklyScheduleFromSettings,
  dayBreakTimes,
  settingsToWeeklySlots,
  type DayScheduleEntry,
  type DoctorSettingsRow,
  type WeeklySchedule,
} from "../../lib/doctor-settings";
import { findFirstAlternativeSlotStarts } from "../../lib/find-alternative-appointment-slots";
import { computePublicAvailabilityCalendar } from "../../lib/public/compute-public-booking-slots";
import { summarizeClinicBreak } from "../../lib/settings-clinic-summary";

/**
 * A break per day (user, 2026-10-10): hours are set per day, so the break is too. It
 * lives on the day in `weekly_schedule` (`break_start` / `break_end`, null for none) and
 * must sit inside that day's hours. A schedule saved before this has one break for the
 * clinic (`professional_clinics.break_start` / `break_end`): days without their own
 * break keys still follow it.
 */

const day = (
  enabled: boolean,
  start = "09:00:00",
  end = "17:00:00",
  breakTimes?: [string, string] | null,
): DayScheduleEntry => ({
  enabled,
  start_time: start,
  end_time: end,
  ...(breakTimes === undefined ? {} : { break_start: breakTimes?.[0] ?? null, break_end: breakTimes?.[1] ?? null }),
});

const week = (patch: Partial<WeeklySchedule> = {}): WeeklySchedule => ({
  monday: day(true),
  tuesday: day(true),
  wednesday: day(true),
  thursday: day(true),
  friday: day(true),
  saturday: day(false),
  sunday: day(false),
  ...patch,
});

const settings = (patch: Partial<DoctorSettingsRow> = {}): DoctorSettingsRow =>
  ({
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
    ...patch,
  }) as DoctorSettingsRow;

describe("a day's break in the schedule", () => {
  it("follows the clinic's one break while the days have none of their own", () => {
    const schedule = buildWeeklyScheduleFromSettings(settings({ break_start: "13:00:00", break_end: "14:00:00" }));
    assert.deepEqual(schedule.monday, day(true, "09:00:00", "17:00:00", ["13:00:00", "14:00:00"]));
    assert.deepEqual(schedule.friday.break_start, "13:00:00");
    const none = buildWeeklyScheduleFromSettings(settings());
    assert.equal(none.monday.break_start, null);
    assert.equal(none.monday.break_end, null);
  });

  it("is the day's own once the day has break keys, null meaning no break", () => {
    const schedule = buildWeeklyScheduleFromSettings(
      settings({
        // An old clinic-level break left behind must not come back.
        break_start: "13:00:00",
        break_end: "14:00:00",
        weekly_schedule: week({
          monday: day(true, "09:00", "17:00", ["12:00", "12:30"]),
          tuesday: day(true, "09:00", "13:00", null),
        }),
      }),
    );
    assert.equal(schedule.monday.break_start, "12:00:00");
    assert.equal(schedule.monday.break_end, "12:30:00");
    assert.equal(schedule.tuesday.break_start, null);
    assert.equal(schedule.tuesday.break_end, null);
    // Wednesday has no keys of its own: the clinic's break.
    assert.equal(schedule.wednesday.break_start, "13:00:00");
  });

  it("reads one day's break, the clinic's as the fallback", () => {
    assert.deepEqual(dayBreakTimes(day(true, "09:00", "17:00", ["12:00:00", "12:30:00"]), "13:00", "14:00"), {
      start: "12:00",
      end: "12:30",
    });
    assert.equal(dayBreakTimes(day(true, "09:00", "17:00", null), "13:00", "14:00"), null);
    assert.deepEqual(dayBreakTimes(day(true), "13:00:00", "14:00:00"), { start: "13:00", end: "14:00" });
    assert.equal(dayBreakTimes(day(true), null, null), null);
    assert.equal(dayBreakTimes(undefined, null, null), null);
  });

  it("travels with each day's slots", () => {
    const slots = settingsToWeeklySlots(
      settings({
        weekly_schedule: week({
          monday: day(true, "09:00", "17:00", ["12:00", "13:00"]),
          tuesday: day(true, "09:00", "13:00", null),
        }),
      }),
    );
    const monday = slots.find((slot) => slot.day_of_week === 1)!;
    const tuesday = slots.find((slot) => slot.day_of_week === 2)!;
    assert.equal(monday.break_start, "12:00:00");
    assert.equal(monday.break_end, "13:00:00");
    assert.equal(tuesday.break_start, null);
  });
});

describe("saving a day's break", () => {
  it("writes each day's break on the day and clears the clinic's one break", () => {
    const columns = locationScheduleColumns({
      weeklySchedule: week({
        monday: day(true, "09:00", "17:00", ["13:00", "14:00"]),
        tuesday: day(true, "09:00", "13:00", null),
      }),
      // An old page's fields are ignored once the days carry their own.
      breakEnabled: true,
      breakStart: "12:00",
      breakEnd: "12:30",
    });
    assert.deepEqual(columns.weekly_schedule.monday, day(true, "09:00:00", "17:00:00", ["13:00:00", "14:00:00"]));
    assert.deepEqual(columns.weekly_schedule.tuesday, day(true, "09:00:00", "13:00:00", null));
    // Days sent without break keys have none.
    assert.deepEqual(columns.weekly_schedule.wednesday, day(true, "09:00:00", "17:00:00", null));
    assert.equal(columns.break_start, null);
    assert.equal(columns.break_end, null);
  });

  it("never saves a closed day's break", () => {
    const columns = locationScheduleColumns({
      weeklySchedule: week({
        monday: day(true, "09:00", "17:00", ["13:00", "14:00"]),
        saturday: day(false, "09:00", "13:00", ["11:00", "11:30"]),
      }),
    });
    assert.equal(columns.weekly_schedule.saturday.break_start, null);
  });

  it("keeps the one clinic break for a save that knows no day breaks", () => {
    const columns = locationScheduleColumns({
      weeklySchedule: week(),
      breakEnabled: true,
      breakStart: "13:00",
      breakEnd: "14:00",
    });
    assert.equal(columns.break_start, "13:00:00");
    assert.equal(columns.break_end, "14:00:00");
    assert.equal("break_start" in columns.weekly_schedule.monday, false);
  });
});

describe("a day's break must make sense", () => {
  const withBreak = (breakTimes: [string, string], start = "09:00", end = "17:00") => ({
    weeklySchedule: week({ tuesday: day(true, start, end, breakTimes) }),
  });

  it("accepts a break inside the day's hours", () => {
    assert.equal(clinicHoursProblem(withBreak(["13:00", "14:00"])), null);
    assert.equal(clinicHoursProblem(withBreak(["09:15", "16:45"])), null);
  });

  it("refuses a break that ends before or when it starts", () => {
    assert.equal(clinicHoursProblem(withBreak(["14:00", "13:00"])), "Tuesday's break must end after 14:00.");
    assert.equal(clinicHoursProblem(withBreak(["13:00:00", "13:00"])), "Tuesday's break must end after 13:00.");
  });

  it("refuses a break outside the day's hours, or on their edge", () => {
    const outside = "Tuesday's break must be within its hours (09:00 – 13:00).";
    assert.equal(clinicHoursProblem(withBreak(["13:00", "14:00"], "09:00", "13:00")), outside);
    assert.equal(clinicHoursProblem(withBreak(["12:00", "13:00"], "09:00", "13:00")), outside);
    assert.equal(clinicHoursProblem(withBreak(["09:00", "10:00"], "09:00", "13:00")), outside);
    assert.equal(clinicHoursProblem(withBreak(["08:00", "10:00"], "09:00", "13:00")), outside);
  });

  it("refuses break times that are not on a quarter hour, or half a break", () => {
    assert.equal(
      clinicHoursProblem(withBreak(["13:00", "13:50"])),
      "Tuesday's break must start and end on a quarter hour (:00, :15, :30 or :45).",
    );
    assert.equal(
      clinicHoursProblem({
        weeklySchedule: week({ tuesday: { ...day(true), break_start: "13:00", break_end: null } }),
      }),
      "Tuesday's break needs a start and an end time.",
    );
  });

  it("says the hours problem first, and ignores a closed day's break", () => {
    const problems = clinicHoursProblems({
      weeklySchedule: week({
        tuesday: day(true, "14:00", "09:00", ["13:00", "12:00"]),
        saturday: day(false, "09:00", "13:00", ["15:00", "14:00"]),
      }),
    });
    assert.deepEqual(problems.days, { tuesday: "Tuesday must end after 14:00." });
  });

  it("suggests a break when one is added: lunch when it fits, else the middle of the day", () => {
    assert.deepEqual(defaultDayBreak("09:00:00", "17:00:00"), { start: "13:00", end: "14:00" });
    assert.deepEqual(defaultDayBreak("09:00", "13:00"), { start: "10:45", end: "11:15" });
    assert.deepEqual(defaultDayBreak("14:00", "20:00"), { start: "16:45", end: "17:15" });
    // The shortest day that can hold one.
    assert.deepEqual(defaultDayBreak("09:00", "09:45"), { start: "09:15", end: "09:30" });
    // Too short for a break inside it.
    assert.equal(defaultDayBreak("09:00", "09:30"), null);
    assert.equal(defaultDayBreak("17:00", "09:00"), null);
  });
});

describe("the clinic card's break summary", () => {
  it("says the break when every open day has the same one", () => {
    assert.equal(
      summarizeClinicBreak(
        week({
          monday: day(true, "09:00", "17:00", ["13:00:00", "14:00:00"]),
          tuesday: day(true, "09:00", "17:00", ["13:00", "14:00"]),
          wednesday: day(false),
          thursday: day(false),
          friday: day(false),
        }),
      ),
      "13:00 – 14:00",
    );
  });

  it("says None without breaks and Varies by day otherwise", () => {
    assert.equal(summarizeClinicBreak(week()), "None");
    assert.equal(summarizeClinicBreak(week({ monday: day(true, "09:00", "17:00", ["13:00", "14:00"]) })), "Varies by day");
    // A closed day's break does not count.
    assert.equal(summarizeClinicBreak(week({ saturday: day(false, "09:00", "13:00", ["11:00", "11:30"]) })), "None");
  });
});

describe("booking around each day's break", () => {
  // Monday 12:00–13:00, Tuesday none; an old clinic-level break is not used.
  const row = settings({
    start_time: "11:00:00",
    end_time: "14:00:00",
    break_start: "11:00:00",
    break_end: "11:30:00",
    weekly_schedule: week({
      monday: day(true, "11:00", "14:00", ["12:00", "13:00"]),
      tuesday: day(true, "11:00", "14:00", null),
      wednesday: day(false),
      thursday: day(false),
      friday: day(false),
    }),
  });
  const weeklySlots = settingsToWeeklySlots(row);

  it("hides a day's break from patients, each day its own", () => {
    const calendar = computePublicAvailabilityCalendar(
      { weeklySlots, takenSlotTimes: [], breakStart: "11:00", breakEnd: "11:30", bookingHorizonDays: 14 },
      14,
    );
    const times = (dayOfWeek: number) =>
      calendar.days
        .filter((entry) => !entry.isToday && new Date(`${entry.dateKey}T12:00:00`).getDay() === dayOfWeek)[0]
        ?.slots.map((slot) => slot.timeLabel);
    assert.deepEqual(times(1), ["11:00", "11:30", "13:00", "13:30"]);
    assert.deepEqual(times(2), ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30"]);
  });

  it("proposes no time that runs into that day's break", () => {
    const starts = (onlyDateKey: string, visitDurationMinutes = 30) =>
      findFirstAlternativeSlotStarts({
        settings: row,
        weeklySlots,
        blockingRows: [] as never[],
        fallbackSlotDurationMinutes: 30,
        visitDurationMinutes,
        excludeAppointmentId: "appt-1",
        searchFromAppointmentIso: "2026-10-12T08:00:00Z",
        avoidStartIso: null,
        nowUtc: new Date("2026-10-05T08:00:00Z"),
        limit: 100,
        onlyDateKey,
      }).map((iso) => iso.slice(11, 16));
    // Monday 2026-10-12, Cyprus is UTC+3: 11:00 → 08:00Z.
    assert.deepEqual(starts("2026-10-12"), ["08:00", "08:30", "10:00", "10:30"]);
    // A 60-minute visit at 11:30 would run into the 12:00 break.
    assert.deepEqual(starts("2026-10-12", 60), ["08:00", "10:00"]);
    assert.deepEqual(starts("2026-10-13"), ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30"]);
  });

  it("shows each day's own break on the agenda", () => {
    const hours: AgendaWorkingHours = {
      weeklySchedule: buildWeeklyScheduleFromSettings(row),
      breakStart: "11:00",
      breakEnd: "11:30",
      slotDurationMinutes: 30,
    };
    const monday = workingWindowForHours(hours, new Date(2026, 9, 12), 8, 20);
    assert.equal(monday.breakStart, 12 * 60);
    assert.equal(monday.breakEnd, 13 * 60);
    const tuesday = workingWindowForHours(hours, new Date(2026, 9, 13), 8, 20);
    assert.equal(tuesday.breakStart, null);
    assert.equal(tuesday.breakEnd, null);
  });

  it("warns when an accepted visit runs into that day's break", () => {
    const schedule = buildWeeklyScheduleFromSettings(row);
    // Monday 11:30 Cyprus for 60 minutes: into the 12:00 break.
    assert.deepEqual(getScheduleOverlapWarning("2026-10-12T08:30:00Z", 60, schedule, "11:00", "11:30"), {
      boundaryTimeLabel: "12:00",
    });
    // Tuesday has no break.
    assert.equal(getScheduleOverlapWarning("2026-10-13T08:30:00Z", 60, schedule, "11:00", "11:30"), null);
  });
});
