import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clinicHoursProblem, clinicHoursProblems } from "../../lib/clinic-hours-check";
import type { WeeklySchedule } from "../../lib/doctor-settings";

/**
 * A clinic's hours must make sense before they are saved (user, 2026-10-10): an open
 * day ends after it starts, and so does the break. Checked in the form and again in
 * POST /api/doctor-settings.
 */

const day = (enabled: boolean, start = "09:00:00", end = "17:00:00") => ({ enabled, start_time: start, end_time: end });
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

describe("clinicHoursProblems", () => {
  it("accepts ordinary hours, with or without a break", () => {
    assert.deepEqual(clinicHoursProblems({ weeklySchedule: week() }), { days: {}, breakTime: null });
    assert.equal(
      clinicHoursProblem({ weeklySchedule: week(), breakEnabled: true, breakStart: "13:00", breakEnd: "14:00" }),
      null,
    );
  });

  it("refuses an open day that ends before it starts, naming the day", () => {
    const problems = clinicHoursProblems({ weeklySchedule: week({ tuesday: day(true, "09:00:00", "08:30:00") }) });
    assert.deepEqual(problems.days, { tuesday: "Tuesday must end after 09:00." });
    assert.equal(
      clinicHoursProblem({ weeklySchedule: week({ tuesday: day(true, "09:00:00", "08:30:00") }) }),
      "Tuesday must end after 09:00.",
    );
  });

  it("refuses a day that ends when it starts", () => {
    assert.equal(
      clinicHoursProblem({ weeklySchedule: week({ friday: day(true, "10:00", "10:00:00") }) }),
      "Friday must end after 10:00.",
    );
  });

  it("reports every wrong day, the first one as the message", () => {
    const schedule = week({ monday: day(true, "12:00", "09:00"), thursday: day(true, "18:00", "17:00") });
    assert.deepEqual(Object.keys(clinicHoursProblems({ weeklySchedule: schedule }).days), ["monday", "thursday"]);
    assert.equal(clinicHoursProblem({ weeklySchedule: schedule }), "Monday must end after 12:00.");
  });

  it("leaves a closed day alone", () => {
    assert.equal(clinicHoursProblem({ weeklySchedule: week({ saturday: day(false, "17:00", "09:00") }) }), null);
  });

  it("refuses a time that is not a time on an open day", () => {
    assert.equal(
      clinicHoursProblem({ weeklySchedule: week({ monday: day(true, "09:00", ":00") }) }),
      "Monday needs a start and an end time.",
    );
  });

  it("refuses a break that ends before or when it starts, only while the break is on", () => {
    const wrong = { weeklySchedule: week(), breakStart: "14:00", breakEnd: "13:00" };
    assert.equal(clinicHoursProblem({ ...wrong, breakEnabled: true }), "The break must end after 14:00.");
    assert.equal(
      clinicHoursProblem({ weeklySchedule: week(), breakEnabled: true, breakStart: "13:00", breakEnd: "13:00:00" }),
      "The break must end after 13:00.",
    );
    assert.equal(clinicHoursProblem({ ...wrong, breakEnabled: false }), null);
  });

  it("has nothing to say when no hours are sent", () => {
    assert.equal(clinicHoursProblem({}), null);
  });
});
