import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { format } from "date-fns";

import {
  agendaHref,
  agendaMonthGrid,
  agendaRangeTitle,
  agendaWeekDays,
  isAgendaNonWorkingDay,
  parseAgendaView,
  shiftAgendaAnchor,
  splitMonthDayItems,
} from "../../lib/agenda-calendar";
import type { WeeklySchedule } from "../../lib/doctor-settings";

const d = (iso: string) => new Date(`${iso}T12:00:00`);
const key = (date: Date) => format(date, "yyyy-MM-dd");

const weekdaysOnly: WeeklySchedule = {
  monday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
  tuesday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
  wednesday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
  thursday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
  friday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
  saturday: { enabled: true, start_time: "09:00:00", end_time: "13:00:00" },
  sunday: { enabled: false, start_time: "09:00:00", end_time: "13:00:00" },
};

describe("parseAgendaView", () => {
  it("accepts day, week and month", () => {
    assert.equal(parseAgendaView("day"), "day");
    assert.equal(parseAgendaView("week"), "week");
    assert.equal(parseAgendaView("month"), "month");
  });

  it("defaults to week for missing or unknown values", () => {
    assert.equal(parseAgendaView(undefined), "week");
    assert.equal(parseAgendaView(null), "week");
    assert.equal(parseAgendaView(""), "week");
    assert.equal(parseAgendaView("year"), "week");
    assert.equal(parseAgendaView(" MONTH "), "month");
  });
});

describe("agendaWeekDays", () => {
  it("returns the 7 days Monday to Sunday, weekend included", () => {
    const days = agendaWeekDays(d("2026-09-30")); // Wednesday
    assert.deepEqual(days.map(key), [
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });

  it("treats Sunday as the last day of its week, not the first of the next", () => {
    const days = agendaWeekDays(d("2026-10-04"));
    assert.equal(key(days[0]!), "2026-09-28");
    assert.equal(key(days[6]!), "2026-10-04");
  });
});

describe("agendaMonthGrid", () => {
  it("builds Monday-first weeks covering the whole month, with neighbour-month days", () => {
    const weeks = agendaMonthGrid(d("2026-09-15"));
    assert.equal(weeks.length, 5);
    assert.ok(weeks.every((w) => w.length === 7));
    assert.equal(key(weeks[0]![0]!), "2026-08-31");
    assert.equal(key(weeks[4]![6]!), "2026-10-04");
  });

  it("uses 6 weeks when the month needs them", () => {
    const weeks = agendaMonthGrid(d("2026-08-10")); // Aug 2026 starts Saturday, 31 days
    assert.equal(weeks.length, 6);
    assert.equal(key(weeks[0]![0]!), "2026-07-27");
    assert.equal(key(weeks[5]![6]!), "2026-09-06");
  });

  it("uses only 4 weeks for a February that starts on Monday", () => {
    const weeks = agendaMonthGrid(d("2027-02-20"));
    assert.equal(weeks.length, 4);
    assert.equal(key(weeks[0]![0]!), "2027-02-01");
    assert.equal(key(weeks[3]![6]!), "2027-02-28");
  });
});

describe("shiftAgendaAnchor", () => {
  it("moves one day in day view", () => {
    assert.equal(key(shiftAgendaAnchor(d("2026-09-28"), "day", 1)), "2026-09-29");
    assert.equal(key(shiftAgendaAnchor(d("2026-09-28"), "day", -1)), "2026-09-27");
  });

  it("moves one week in week view", () => {
    assert.equal(key(shiftAgendaAnchor(d("2026-09-28"), "week", 1)), "2026-10-05");
    assert.equal(key(shiftAgendaAnchor(d("2026-09-28"), "week", -1)), "2026-09-21");
  });

  it("moves one month in month view, clamping to the month's last day", () => {
    assert.equal(key(shiftAgendaAnchor(d("2026-09-28"), "month", 1)), "2026-10-28");
    assert.equal(key(shiftAgendaAnchor(d("2027-01-31"), "month", 1)), "2027-02-28");
    assert.equal(key(shiftAgendaAnchor(d("2026-01-15"), "month", -1)), "2025-12-15");
  });
});

describe("agendaRangeTitle", () => {
  it("titles the day view with the full date", () => {
    assert.equal(agendaRangeTitle(d("2026-09-28"), "day"), "Monday, 28 September 2026");
  });

  it("titles a week inside one month compactly", () => {
    assert.equal(agendaRangeTitle(d("2026-09-09"), "week"), "7 – 13 Sep 2026");
  });

  it("titles a week spanning two months", () => {
    assert.equal(agendaRangeTitle(d("2026-09-30"), "week"), "28 Sep – 4 Oct 2026");
  });

  it("titles a week spanning two years", () => {
    assert.equal(agendaRangeTitle(d("2026-12-30"), "week"), "28 Dec 2026 – 3 Jan 2027");
  });

  it("titles the month view with month and year", () => {
    assert.equal(agendaRangeTitle(d("2026-09-28"), "month"), "September 2026");
  });
});

describe("splitMonthDayItems", () => {
  it("shows everything when it fits", () => {
    assert.deepEqual(splitMonthDayItems(["a", "b", "c"], 3), {
      visible: ["a", "b", "c"],
      hiddenCount: 0,
    });
  });

  it("keeps the first items and counts the rest for '+N more'", () => {
    assert.deepEqual(splitMonthDayItems(["a", "b", "c", "d", "e"], 3), {
      visible: ["a", "b", "c"],
      hiddenCount: 2,
    });
  });

  it("handles an empty day", () => {
    assert.deepEqual(splitMonthDayItems([], 3), { visible: [], hiddenCount: 0 });
  });
});

describe("isAgendaNonWorkingDay", () => {
  it("follows the doctor's weekly schedule, weekend included", () => {
    assert.equal(isAgendaNonWorkingDay(d("2026-09-28"), weekdaysOnly), false); // Mon
    assert.equal(isAgendaNonWorkingDay(d("2026-10-03"), weekdaysOnly), false); // Sat (open)
    assert.equal(isAgendaNonWorkingDay(d("2026-10-04"), weekdaysOnly), true); // Sun (closed)
  });

  it("never greys a day out when there is no schedule", () => {
    assert.equal(isAgendaNonWorkingDay(d("2026-10-04"), null), false);
  });
});

describe("agendaHref", () => {
  it("keeps the default week view out of the URL", () => {
    assert.equal(agendaHref({ view: "week", dateKey: "2026-09-28" }), "/agenda?date=2026-09-28");
  });

  it("adds the view when it is not the default", () => {
    assert.equal(
      agendaHref({ view: "month", dateKey: "2026-09-28" }),
      "/agenda?view=month&date=2026-09-28",
    );
    assert.equal(agendaHref({ view: "day", dateKey: null }), "/agenda?view=day");
  });

  it("returns the bare path for the default state", () => {
    assert.equal(agendaHref({ view: "week", dateKey: null }), "/agenda");
  });
});
