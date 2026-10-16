import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DoctorLocationRow } from "../../lib/doctor-locations";
import {
  FINDER_CARD_NO_ONLINE_BOOKING,
  finderCardOpeningHours,
  finderCardPatientsSeenText,
  finderCardRequestCountText,
} from "../../lib/finder-profile-card";

function location(overrides: Partial<DoctorLocationRow> = {}): DoctorLocationRow {
  return {
    id: "link-1",
    doctor_id: "pro-1",
    sort_order: 0,
    label: null,
    district: "Paphos",
    clinic_address: "Agapinoros 68, Paphos",
    town: null,
    latitude: null,
    longitude: null,
    clinic_place_id: null,
    pause_online_bookings: false,
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    start_time: "09:00:00",
    end_time: "17:00:00",
    break_start: null,
    break_end: null,
    slot_duration_minutes: 30,
    ...overrides,
  };
}

describe("finder profile card (mockup L)", () => {
  it("the listing's count line: nothing at 0, then one patient / N patients", () => {
    assert.equal(finderCardRequestCountText(0), null);
    assert.equal(finderCardRequestCountText(-2), null);
    assert.equal(finderCardRequestCountText(1), "1 patient requested online booking");
    assert.equal(finderCardRequestCountText(3), "3 patients requested online booking");
  });

  it("one sentence for a paused clinic and an ended subscription", () => {
    assert.deepEqual(FINDER_CARD_NO_ONLINE_BOOKING, {
      title: "Online booking not available at this clinic",
      body: "Call the clinic to book.",
    });
  });

  it("who she sees, as on her profile; nothing when not chosen", () => {
    assert.equal(finderCardPatientsSeenText("all"), "Sees adults and children");
    assert.equal(finderCardPatientsSeenText("adults"), "Sees adults only");
    assert.equal(finderCardPatientsSeenText("children"), "Sees children only");
    assert.equal(finderCardPatientsSeenText(null), null);
  });

  it("the clinic's hours, grouped as on the profile", () => {
    assert.deepEqual(finderCardOpeningHours(location()), [{ days: "Mon–Fri", hours: "09:00–17:00" }]);
  });

  it("days with other hours get their own line, the break splits a day", () => {
    const schedule = {
      monday: { enabled: true, start_time: "09:00:00", end_time: "13:00:00" },
      tuesday: { enabled: true, start_time: "09:00:00", end_time: "13:00:00" },
      wednesday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
      thursday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
      friday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
      saturday: { enabled: false, start_time: "09:00:00", end_time: "13:00:00" },
      sunday: { enabled: false, start_time: "09:00:00", end_time: "13:00:00" },
    };
    const hours = finderCardOpeningHours(location({ weekly_schedule: schedule as DoctorLocationRow["weekly_schedule"] }));
    assert.deepEqual(hours, [
      { days: "Mon, Tue", hours: "09:00–13:00" },
      { days: "Wed–Fri", hours: "09:00–17:00" },
    ]);
  });

  it("no location, no hours", () => {
    assert.deepEqual(finderCardOpeningHours(null), []);
  });
});
