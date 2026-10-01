import assert from "node:assert/strict";
import { describe, it } from "node:test";

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

describe("summarizeClinicBreak", () => {
  it("shows the break when there is one", () => {
    assert.equal(summarizeClinicBreak({ breakEnabled: true, breakStart: "13:00", breakEnd: "14:00" }), "13:00 – 14:00");
  });

  it("says None without a break", () => {
    assert.equal(summarizeClinicBreak({ breakEnabled: false, breakStart: "13:00", breakEnd: "14:00" }), "None");
  });
});

describe("clinicBookingStatus", () => {
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
