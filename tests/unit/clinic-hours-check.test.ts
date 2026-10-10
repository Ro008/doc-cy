import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clinicHoursProblem, clinicHoursProblems, clinicTimeOptions } from "../../lib/clinic-hours-check";
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

  // User, 2026-10-10: 17:02 or 16:23 make no sense; times go by quarter hours.
  it("refuses a time that is not on a quarter hour", () => {
    const quarters = "on a quarter hour (:00, :15, :30 or :45).";
    assert.equal(
      clinicHoursProblem({ weeklySchedule: week({ monday: day(true, "09:00", "17:02") }) }),
      `Monday must start and end ${quarters}`,
    );
    assert.equal(
      clinicHoursProblem({ weeklySchedule: week({ wednesday: day(true, "09:10:00", "17:00:00") }) }),
      `Wednesday must start and end ${quarters}`,
    );
    assert.equal(
      clinicHoursProblem({ weeklySchedule: week(), breakEnabled: true, breakStart: "13:00", breakEnd: "13:50" }),
      `The break must start and end ${quarters}`,
    );
    assert.equal(clinicHoursProblem({ weeklySchedule: week({ monday: day(true, "08:15", "16:45") }) }), null);
    // Closed days and a switched-off break are left alone.
    assert.equal(clinicHoursProblem({ weeklySchedule: week({ sunday: day(false, "09:07", "17:02") }) }), null);
    assert.equal(clinicHoursProblem({ weeklySchedule: week(), breakStart: "13:07", breakEnd: "13:50" }), null);
  });
});

describe("clinicTimeOptions", () => {
  it("offers every quarter hour of the day", () => {
    const options = clinicTimeOptions();
    assert.equal(options.length, 96);
    assert.deepEqual(options.slice(0, 5), ["00:00", "00:15", "00:30", "00:45", "01:00"]);
    assert.equal(options.at(-1), "23:45");
  });

  it("offers only the times after a start, for an end time", () => {
    const options = clinicTimeOptions({ after: "09:00:00" });
    assert.equal(options[0], "09:15");
    assert.equal(options.at(-1), "23:45");
    assert.deepEqual(clinicTimeOptions({ after: "23:45" }), []);
  });

  it("keeps a saved time that is off the grid or no longer after the start, in order", () => {
    assert.deepEqual(clinicTimeOptions({ after: "23:00", keep: "23:20" }), ["23:15", "23:20", "23:30", "23:45"]);
    assert.deepEqual(clinicTimeOptions({ after: "23:15", keep: "08:00:00" }), ["08:00", "23:30", "23:45"]);
    assert.equal(clinicTimeOptions({ keep: "17:00" }).length, 96);
  });
});
