import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyToAllCopy,
  hoursVisitNotes,
  pauseClinicNotes,
  visitOutsideWeek,
  visitsLeftOutside,
} from "../../lib/clinic-hours-visits";

import type { DayKey, WeeklySchedule } from "../../lib/doctor-settings";
import {
  clinicBookingStatus,
  summarizeClinicBreak,
  summarizeClinicDays,
  summarizeClinicHours,
} from "../../lib/settings-clinic-summary";

function schedule(
  open: Partial<Record<DayKey, [string, string]>>,
): WeeklySchedule {
  const day = (key: DayKey) => {
    const hours = open[key];
    return hours
      ? { enabled: true, start_time: `${hours[0]}:00`, end_time: `${hours[1]}:00` }
      : { enabled: false, start_time: "09:00:00", end_time: "17:00:00" };
  };
  return {
    monday: day("monday"),
    tuesday: day("tuesday"),
    wednesday: day("wednesday"),
    thursday: day("thursday"),
    friday: day("friday"),
    saturday: day("saturday"),
    sunday: day("sunday"),
  };
}

const nineToFive: [string, string] = ["09:00", "17:00"];
const weekdays = schedule({
  monday: nineToFive,
  tuesday: nineToFive,
  wednesday: nineToFive,
  thursday: nineToFive,
  friday: nineToFive,
});

describe("summarizeClinicDays", () => {
  it("shows a run of days as a range", () => {
    assert.equal(summarizeClinicDays(weekdays), "Mon – Fri");
  });

  it("lists days that are not in a row", () => {
    assert.equal(
      summarizeClinicDays(schedule({ monday: nineToFive, wednesday: nineToFive, friday: nineToFive })),
      "Mon, Wed, Fri",
    );
  });

  it("mixes ranges and single days", () => {
    assert.equal(
      summarizeClinicDays(
        schedule({ monday: nineToFive, tuesday: nineToFive, wednesday: nineToFive, saturday: nineToFive }),
      ),
      "Mon – Wed, Sat",
    );
  });

  it("writes two days in a row as two days", () => {
    assert.equal(summarizeClinicDays(schedule({ saturday: nineToFive, sunday: nineToFive })), "Sat, Sun");
  });

  it("shows one day on its own", () => {
    assert.equal(summarizeClinicDays(schedule({ saturday: ["10:00", "14:00"] })), "Sat");
  });

  it("says Closed when no day is open", () => {
    assert.equal(summarizeClinicDays(schedule({})), "Closed");
  });
});

describe("summarizeClinicHours", () => {
  it("shows the hours when every open day matches", () => {
    assert.equal(summarizeClinicHours(weekdays), "09:00 – 17:00");
  });

  it("ignores the hours of closed days", () => {
    const s = schedule({ saturday: ["10:00", "14:00"] });
    assert.equal(summarizeClinicHours(s), "10:00 – 14:00");
  });

  it("says the hours vary when open days differ", () => {
    const s = schedule({ monday: nineToFive, wednesday: ["09:00", "13:00"] });
    assert.equal(summarizeClinicHours(s), "Varies by day");
  });

  it("shows a dash when no day is open", () => {
    assert.equal(summarizeClinicHours(schedule({})), "—");
  });
});

// Breaks are per day (user, 2026-10-10): more cases in tests/unit/day-breaks.test.ts.
describe("summarizeClinicBreak", () => {
  const withBreak = (week: WeeklySchedule, day: DayKey, start: string | null, end: string | null) => ({
    ...week,
    [day]: { ...week[day], break_start: start, break_end: end },
  });
  const week = schedule({ monday: ["09:00", "17:00"], tuesday: ["09:00", "17:00"] });

  it("shows the break the open days share", () => {
    const both = withBreak(withBreak(week, "monday", "13:00:00", "14:00:00"), "tuesday", "13:00:00", "14:00:00");
    assert.equal(summarizeClinicBreak(both), "13:00 – 14:00");
  });

  it("says None without a break, and Varies by day when they differ", () => {
    assert.equal(summarizeClinicBreak(week), "None");
    assert.equal(summarizeClinicBreak(withBreak(week, "monday", "13:00:00", "14:00:00")), "Varies by day");
  });
});

describe("clinicBookingStatus", () => {
  it("is off for every clinic once pro access has ended, whatever the switches say", () => {
    for (const pauseOnlineBookings of [false, true]) {
      for (const holidayActive of [false, true]) {
        assert.deepEqual(clinicBookingStatus({ pauseOnlineBookings, holidayActive, accessEnded: true }), {
          kind: "ended",
          label: "Online booking off",
        });
      }
    }
  });

  it("takes bookings when neither paused nor on holiday", () => {
    assert.deepEqual(clinicBookingStatus({ pauseOnlineBookings: false, holidayActive: false }), {
      kind: "taking",
      label: "Taking online bookings",
    });
  });

  it("is paused when the clinic is paused", () => {
    assert.deepEqual(clinicBookingStatus({ pauseOnlineBookings: true, holidayActive: false }), {
      kind: "paused",
      label: "Online booking paused",
    });
  });

  it("holiday mode wins over the clinic's own switch", () => {
    for (const pauseOnlineBookings of [true, false]) {
      assert.deepEqual(clinicBookingStatus({ pauseOnlineBookings, holidayActive: true }), {
        kind: "holiday",
        label: "Paused for your holiday",
      });
    }
  });
});

/**
 * Settings → Clinics, stage 5 (user, 2026-10-11): she is warned before a save leaves
 * visits outside her hours, and before pausing a clinic that has visits; nothing is
 * ever cancelled. "Apply to all my clinics" copies the week or the slot length.
 */
const hoursDay = (start: string, end: string, breakStart: string | null = null, breakEnd: string | null = null) => ({
  enabled: true,
  start_time: start,
  end_time: end,
  break_start: breakStart,
  break_end: breakEnd,
});
const closedDay = { ...hoursDay("09:00:00", "17:00:00"), enabled: false };
const hoursWeek = (weekday = hoursDay("09:00:00", "17:00:00")): WeeklySchedule => ({
  monday: weekday,
  tuesday: weekday,
  wednesday: weekday,
  thursday: weekday,
  friday: weekday,
  saturday: closedDay,
  sunday: closedDay,
});

describe("visitOutsideWeek", () => {
  // Wednesday 7 October 2026; Cyprus is UTC+3.
  it("is null inside the day's hours", () => {
    assert.equal(visitOutsideWeek("2026-10-07T06:00:00Z", hoursWeek()), null);
    assert.equal(visitOutsideWeek("2026-10-07T13:30:00Z", hoursWeek()), null);
  });

  it("says when the day is closed", () => {
    assert.equal(visitOutsideWeek("2026-10-10T07:00:00Z", hoursWeek()), "closed");
  });

  it("says when the visit starts before opening or from closing time on", () => {
    assert.equal(visitOutsideWeek("2026-10-07T05:30:00Z", hoursWeek()), "hours");
    assert.equal(visitOutsideWeek("2026-10-07T14:00:00Z", hoursWeek()), "hours");
  });

  it("says when the visit starts in the day's break", () => {
    const week = hoursWeek(hoursDay("09:00:00", "17:00:00", "13:00:00", "14:00:00"));
    assert.equal(visitOutsideWeek("2026-10-07T10:00:00Z", week), "break");
    assert.equal(visitOutsideWeek("2026-10-07T10:30:00Z", week), "break");
    assert.equal(visitOutsideWeek("2026-10-07T11:00:00Z", week), null);
  });
});

describe("visitsLeftOutside", () => {
  const visit = (id: string, at: string) => ({ id, at });

  it("lists the visits the new week leaves out, with why", () => {
    const next = hoursWeek(hoursDay("10:00:00", "16:00:00", "13:00:00", "14:00:00"));
    const left = visitsLeftOutside(
      [
        visit("early", "2026-10-07T06:00:00Z"), // 09:00, now before opening
        visit("lunch", "2026-10-07T10:00:00Z"), // 13:00, now in the break
        visit("fine", "2026-10-07T08:00:00Z"), // 11:00
      ],
      hoursWeek(),
      next,
    );
    assert.deepEqual(
      left.map((row) => [row.id, row.reason]),
      [
        ["early", "hours"],
        ["lunch", "break"],
      ],
    );
  });

  it("leaves out a visit that was already outside her hours", () => {
    // 19:00 on a day that closes at 17:00, before and after: not caused by this change.
    assert.deepEqual(
      visitsLeftOutside([visit("late", "2026-10-07T16:00:00Z")], hoursWeek(), hoursWeek(hoursDay("10:00:00", "16:00:00"))),
      [],
    );
  });

  it("flags a day she closes", () => {
    const next = { ...hoursWeek(), wednesday: closedDay };
    assert.deepEqual(
      visitsLeftOutside([visit("wed", "2026-10-07T07:00:00Z")], hoursWeek(), next).map((row) => row.reason),
      ["closed"],
    );
  });
});

describe("the words of the stage 5 warnings", () => {
  it("hours: says what falls outside, and that nothing is cancelled", () => {
    assert.deepEqual(hoursVisitNotes({ confirmed: 0, open: 0 }), []);
    assert.deepEqual(hoursVisitNotes({ confirmed: 1, open: 1 }), [
      "1 confirmed visit falls outside these hours. It stays in your agenda: changing your hours cancels nothing.",
      "1 request outside these hours is waiting for your answer.",
    ]);
    assert.deepEqual(hoursVisitNotes({ confirmed: 2, open: 3 }), [
      "2 confirmed visits fall outside these hours. They stay in your agenda: changing your hours cancels nothing.",
      "3 requests outside these hours are waiting for your answer.",
    ]);
  });

  it("pausing a clinic: visits stay and requests can still be answered", () => {
    assert.deepEqual(pauseClinicNotes({ confirmed: 0, open: 0 }), []);
    assert.deepEqual(pauseClinicNotes({ confirmed: 1, open: 2 }), [
      "1 confirmed visit at this clinic stays in your agenda.",
      "2 requests at this clinic are waiting for your answer. You can still answer them.",
    ]);
    assert.deepEqual(pauseClinicNotes({ confirmed: 4, open: 1 }), [
      "4 confirmed visits at this clinic stay in your agenda.",
      "1 request at this clinic is waiting for your answer. You can still answer it.",
    ]);
  });

  it("apply to all: names the other clinics and says what is copied", () => {
    assert.deepEqual(applyToAllCopy("week", "Clinic A", ["Clinic B", "Clinic C"]), {
      title: "Apply these hours to all your clinics?",
      description:
        "Clinic B and Clinic C will get the same open days, hours and breaks as Clinic A. Slot length, booking limits and the online booking switch stay as they are at each clinic.",
      confirm: "Apply to all 3 clinics",
      done: "Hours applied to all 3 of your clinics.",
    });
    assert.deepEqual(applyToAllCopy("slot", "Clinic A", ["Clinic B"], 45), {
      title: "Apply this slot length to all your clinics?",
      description:
        "Clinic B will use 45-minute slots like Clinic A. Hours, booking limits and the online booking switch stay as they are at each clinic.",
      confirm: "Apply to all 2 clinics",
      done: "45-minute slots applied to all 2 of your clinics.",
    });
  });
});
