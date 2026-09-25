import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTodaySchedule,
  dashboardGreeting,
  requestedAgoLabel,
  selectAwaitingPatient,
  selectPendingRequests,
  startsInLabel,
  todaySummaryLabel,
  todayWorkingWindow,
  type DashboardAppointmentRow,
} from "../../lib/doctor-dashboard";

// 2026-09-25 is summer time in Cyprus (UTC+3): 06:50Z is 09:50 local.
const NOW = Date.parse("2026-09-25T06:50:00Z");

function row(partial: Partial<DashboardAppointmentRow> & { id: string }): DashboardAppointmentRow {
  return {
    patient_name: `Patient ${partial.id}`,
    appointment_datetime: "2026-09-25T06:00:00Z",
    status: "CONFIRMED",
    duration_minutes: 30,
    created_at: "2026-09-20T10:00:00Z",
    is_new_patient: null,
    attendance: null,
    proposal_expires_at: null,
    reason: null,
    location_id: null,
    ...partial,
  };
}

describe("selectPendingRequests", () => {
  it("keeps only future requests, oldest request first", () => {
    const rows = [
      row({ id: "newer", status: "REQUESTED", appointment_datetime: "2026-09-29T07:30:00Z", created_at: "2026-09-25T03:00:00Z" }),
      row({ id: "older", status: "requested", appointment_datetime: "2026-10-02T06:00:00Z", created_at: "2026-09-23T08:00:00Z" }),
      row({ id: "past", status: "REQUESTED", appointment_datetime: "2026-09-25T06:00:00Z", created_at: "2026-09-22T08:00:00Z" }),
      row({ id: "confirmed", status: "CONFIRMED", appointment_datetime: "2026-09-29T07:30:00Z" }),
      row({ id: "cancelled", status: "CANCELLED", appointment_datetime: "2026-09-29T07:30:00Z" }),
      row({ id: "proposal", status: "NEEDS_RESCHEDULE", appointment_datetime: "2026-09-29T07:30:00Z" }),
    ];
    assert.deepEqual(
      selectPendingRequests(rows, NOW).map((r) => r.id),
      ["older", "newer"],
    );
  });

  it("puts requests without a created_at last, by visit time", () => {
    const rows = [
      row({ id: "no-date-late", status: "REQUESTED", appointment_datetime: "2026-10-05T06:00:00Z", created_at: null }),
      row({ id: "dated", status: "REQUESTED", appointment_datetime: "2026-10-09T06:00:00Z", created_at: "2026-09-24T06:00:00Z" }),
      row({ id: "no-date-early", status: "REQUESTED", appointment_datetime: "2026-10-01T06:00:00Z", created_at: null }),
    ];
    assert.deepEqual(
      selectPendingRequests(rows, NOW).map((r) => r.id),
      ["dated", "no-date-early", "no-date-late"],
    );
  });

  it("returns an empty list when nothing is pending", () => {
    assert.deepEqual(selectPendingRequests([], NOW), []);
  });
});

describe("selectAwaitingPatient", () => {
  it("keeps only proposals that have not expired", () => {
    const rows = [
      row({ id: "live", status: "NEEDS_RESCHEDULE", proposal_expires_at: "2026-09-26T06:00:00Z" }),
      row({ id: "expired", status: "NEEDS_RESCHEDULE", proposal_expires_at: "2026-09-24T06:00:00Z" }),
      row({ id: "no-expiry", status: "NEEDS_RESCHEDULE", proposal_expires_at: null }),
      row({ id: "requested", status: "REQUESTED", proposal_expires_at: "2026-09-26T06:00:00Z" }),
    ];
    assert.deepEqual(
      selectAwaitingPatient(rows, NOW).map((r) => r.id),
      ["live"],
    );
  });
});

describe("buildTodaySchedule", () => {
  const today = [
    row({ id: "done", appointment_datetime: "2026-09-25T06:00:00Z", duration_minutes: 20, patient_name: "Christina L." }),
    row({ id: "next", appointment_datetime: "2026-09-25T07:30:00Z", duration_minutes: 30, is_new_patient: true }),
    row({ id: "later", appointment_datetime: "2026-09-25T09:00:00Z", duration_minutes: null }),
  ];

  it("lists today's confirmed visits in time order with Cyprus times", () => {
    const schedule = buildTodaySchedule([today[2], today[0], today[1]], { nowMs: NOW });
    assert.deepEqual(
      schedule.items.map((i) => [i.id, i.rangeLabel]),
      [
        ["done", "09:00–09:20"],
        ["next", "10:30–11:00"],
        ["later", "12:00–12:30"],
      ],
    );
    assert.equal(schedule.items[0].patientName, "Christina L.");
    assert.equal(schedule.items[1].isNewPatient, true);
    assert.equal(schedule.items[0].startMinute, 9 * 60);
    assert.equal(schedule.items[0].endMinute, 9 * 60 + 20);
  });

  it("uses 30 minutes when the duration is missing", () => {
    const schedule = buildTodaySchedule([today[2]], { nowMs: NOW });
    assert.equal(schedule.items[0].endMinute - schedule.items[0].startMinute, 30);
  });

  it("marks ended visits as past and the first unfinished one as next", () => {
    const schedule = buildTodaySchedule(today, { nowMs: NOW });
    assert.deepEqual(
      schedule.items.map((i) => [i.id, i.isPast, i.isNext]),
      [
        ["done", true, false],
        ["next", false, true],
        ["later", false, false],
      ],
    );
  });

  it("treats a visit in progress as next, not past", () => {
    const during = Date.parse("2026-09-25T06:10:00Z"); // 09:10 local
    const schedule = buildTodaySchedule(today, { nowMs: during });
    assert.deepEqual(
      schedule.items.map((i) => [i.id, i.isPast, i.isNext]),
      [
        ["done", false, true],
        ["next", false, false],
        ["later", false, false],
      ],
    );
  });

  it("carries the no-show mark", () => {
    const schedule = buildTodaySchedule(
      [row({ id: "ns", appointment_datetime: "2026-09-25T06:00:00Z", attendance: "no_show" })],
      { nowMs: NOW },
    );
    assert.equal(schedule.items[0].isNoShow, true);
  });

  it("leaves out other days, cancelled visits and open requests", () => {
    const schedule = buildTodaySchedule(
      [
        ...today,
        row({ id: "tomorrow", appointment_datetime: "2026-09-26T06:00:00Z" }),
        row({ id: "yesterday", appointment_datetime: "2026-09-24T06:00:00Z" }),
        row({ id: "cancelled", status: "CANCELLED", appointment_datetime: "2026-09-25T08:00:00Z" }),
        row({ id: "requested", status: "REQUESTED", appointment_datetime: "2026-09-25T08:00:00Z" }),
        row({ id: "proposal", status: "NEEDS_RESCHEDULE", appointment_datetime: "2026-09-25T08:00:00Z" }),
      ],
      { nowMs: NOW },
    );
    assert.deepEqual(
      schedule.items.map((i) => i.id),
      ["done", "next", "later"],
    );
  });

  it("uses the Cyprus date, not the UTC date", () => {
    // 21:30Z on the 24th is 00:30 on the 25th in Cyprus.
    const schedule = buildTodaySchedule(
      [row({ id: "early", appointment_datetime: "2026-09-24T21:30:00Z" })],
      { nowMs: NOW },
    );
    assert.deepEqual(schedule.items.map((i) => i.id), ["early"]);
    assert.equal(schedule.items[0].startMinute, 30);
  });

  it("shows 09:00–18:00 by default and grows to fit earlier or later visits", () => {
    assert.deepEqual(
      [buildTodaySchedule([], { nowMs: NOW }).startHour, buildTodaySchedule([], { nowMs: NOW }).endHour],
      [9, 18],
    );
    const schedule = buildTodaySchedule(
      [
        row({ id: "early", appointment_datetime: "2026-09-25T04:30:00Z" }), // 07:30
        row({ id: "late", appointment_datetime: "2026-09-25T16:40:00Z" }), // 19:40–20:10
      ],
      { nowMs: NOW },
    );
    assert.equal(schedule.startHour, 7);
    assert.equal(schedule.endHour, 21);
  });

  it("respects the working hours it is given", () => {
    const schedule = buildTodaySchedule([], { nowMs: NOW, startHour: 8, endHour: 14 });
    assert.equal(schedule.startHour, 8);
    assert.equal(schedule.endHour, 14);
  });

  it("gives the current minute only while it is inside the window", () => {
    assert.equal(buildTodaySchedule([], { nowMs: NOW }).nowMinute, 9 * 60 + 50);
    const evening = Date.parse("2026-09-25T17:30:00Z"); // 20:30 local
    assert.equal(buildTodaySchedule([], { nowMs: evening }).nowMinute, null);
  });
});

describe("todayWorkingWindow", () => {
  const closed = { enabled: false, start_time: "09:00:00", end_time: "17:00:00" };
  function hours(friday: { enabled: boolean; start_time: string; end_time: string }, saturday = closed) {
    return {
      weeklySchedule: {
        monday: closed, tuesday: closed, wednesday: closed, thursday: closed,
        friday, saturday, sunday: closed,
      },
      breakStart: "13:30",
      breakEnd: "15:00",
      slotDurationMinutes: 30,
    };
  }

  it("uses today's hours in Cyprus, rounded out to whole hours, with the break", () => {
    const window = todayWorkingWindow(
      [hours({ enabled: true, start_time: "08:30:00", end_time: "16:45:00" })],
      NOW,
    );
    assert.deepEqual(window, { startHour: 8, endHour: 17, breakStart: 13 * 60 + 30, breakEnd: 15 * 60 });
  });

  it("returns null on a day off", () => {
    assert.equal(todayWorkingWindow([hours(closed)], NOW), null);
    assert.equal(todayWorkingWindow([], NOW), null);
  });

  it("joins several clinics and drops the break", () => {
    const window = todayWorkingWindow(
      [
        hours({ enabled: true, start_time: "09:00:00", end_time: "13:00:00" }),
        hours({ enabled: true, start_time: "15:00:00", end_time: "19:00:00" }),
      ],
      NOW,
    );
    assert.deepEqual(window, { startHour: 9, endHour: 19, breakStart: null, breakEnd: null });
  });

  it("picks the weekday from the Cyprus date", () => {
    // 21:30Z on Friday is already Saturday 00:30 in Cyprus.
    const window = todayWorkingWindow(
      [hours(closed, { enabled: true, start_time: "10:00:00", end_time: "14:00:00" })],
      Date.parse("2026-09-25T21:30:00Z"),
    );
    assert.deepEqual(window, { startHour: 10, endHour: 14, breakStart: 13 * 60 + 30, breakEnd: 15 * 60 });
  });
});

describe("todaySummaryLabel", () => {
  it("describes an empty day", () => {
    assert.equal(todaySummaryLabel([]), "No appointments today");
  });

  it("counts visits and gives the first start and last end", () => {
    const { items } = buildTodaySchedule(
      [
        row({ id: "a", appointment_datetime: "2026-09-25T06:00:00Z", duration_minutes: 20 }),
        row({ id: "b", appointment_datetime: "2026-09-25T14:30:00Z", duration_minutes: 20 }),
      ],
      { nowMs: NOW },
    );
    assert.equal(todaySummaryLabel(items), "2 appointments · 09:00 to 17:50");
    assert.equal(todaySummaryLabel(items.slice(0, 1)), "1 appointment · 09:00 to 09:20");
  });
});

describe("dashboardGreeting", () => {
  it("follows the Cyprus clock", () => {
    assert.equal(dashboardGreeting(Date.parse("2026-09-25T05:00:00Z")), "Good morning"); // 08:00
    assert.equal(dashboardGreeting(Date.parse("2026-09-25T09:30:00Z")), "Good afternoon"); // 12:30
    assert.equal(dashboardGreeting(Date.parse("2026-09-25T15:30:00Z")), "Good evening"); // 18:30
    assert.equal(dashboardGreeting(Date.parse("2026-09-25T21:30:00Z")), "Good evening"); // 00:30
  });
});

describe("requestedAgoLabel", () => {
  it("describes how long a request has waited", () => {
    const at = (iso: string) => requestedAgoLabel(iso, NOW);
    assert.equal(at("2026-09-25T06:49:40Z"), "just now");
    assert.equal(at("2026-09-25T06:45:00Z"), "5 min ago");
    assert.equal(at("2026-09-25T03:50:00Z"), "3 h ago");
    assert.equal(at("2026-09-24T04:50:00Z"), "yesterday");
    assert.equal(at("2026-09-23T04:50:00Z"), "2 days ago");
  });

  it("returns null for a missing or broken date", () => {
    assert.equal(requestedAgoLabel(null, NOW), null);
    assert.equal(requestedAgoLabel("not a date", NOW), null);
  });
});

describe("startsInLabel", () => {
  it("counts down to the visit", () => {
    assert.equal(startsInLabel("2026-09-25T07:30:00Z", NOW), "in 40 min");
    assert.equal(startsInLabel("2026-09-25T07:50:00Z", NOW), "in 1 h");
    assert.equal(startsInLabel("2026-09-25T08:20:00Z", NOW), "in 1 h 30 min");
  });

  it("says Now once the visit has started", () => {
    assert.equal(startsInLabel("2026-09-25T06:50:00Z", NOW), "Now");
    assert.equal(startsInLabel("2026-09-25T06:40:00Z", NOW), "Now");
  });
});
