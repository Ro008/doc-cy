import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLINIC_SETTINGS_COLUMNS,
  splitLocationPatch,
} from "../../lib/professional-clinic-settings-writes";

/**
 * Point D3a: a professional's own settings at a clinic (hours, breaks, slot length,
 * label, bookings pause) are written to their professional_clinics row. Where the
 * clinic is and which one it is stays on doctor_locations until the registration
 * redesign moves it behind admin review. One save carries both, so it has to be split.
 */

describe("splitLocationPatch", () => {
  it("sends per-clinic settings to the join row and the address to the location", () => {
    const { settings, location } = splitLocationPatch({
      monday: true,
      tuesday: false,
      wednesday: true,
      thursday: false,
      friday: true,
      saturday: false,
      sunday: false,
      start_time: "09:00:00",
      end_time: "17:00:00",
      weekly_schedule: { monday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" } },
      break_start: "13:00:00",
      break_end: "14:00:00",
      slot_duration_minutes: 45,
      pause_online_bookings: false,
      label: "Evenings",
      district: "Paphos",
      clinic_address: "B6 39, Geroskipou, Pafos 8035, Cyprus",
      town: "Geroskipou",
      latitude: 34.76,
      longitude: 32.44,
      clinic_place_id: "place-1",
      updated_at: "2026-09-23T07:00:00.000Z",
    });

    assert.deepEqual(Object.keys(settings).sort(), [...CLINIC_SETTINGS_COLUMNS].sort());
    assert.equal(settings.slot_duration_minutes, 45);
    assert.equal(settings.label, "Evenings");
    assert.equal(settings.pause_online_bookings, false);

    assert.deepEqual(location, {
      district: "Paphos",
      clinic_address: "B6 39, Geroskipou, Pafos 8035, Cyprus",
      town: "Geroskipou",
      latitude: 34.76,
      longitude: 32.44,
      clinic_place_id: "place-1",
    });
  });

  it("never lets updated_at or ownership columns through to either side", () => {
    const { settings, location } = splitLocationPatch({
      updated_at: "2026-09-23T07:00:00.000Z",
      id: "loc-1",
      doctor_id: "pro-1",
      professional_id: "pro-1",
      clinic_id: "clinic-1",
      slot_duration_minutes: 30,
    });
    assert.deepEqual(settings, { slot_duration_minutes: 30 });
    assert.deepEqual(location, {});
  });

  it("keeps a pause-only change on the settings side", () => {
    const { settings, location } = splitLocationPatch({ pause_online_bookings: true });
    assert.deepEqual(settings, { pause_online_bookings: true });
    assert.deepEqual(location, {});
  });

  it("leaves linkage owned by the location (primary flag and order) out of the settings", () => {
    const { settings, location } = splitLocationPatch({ is_primary: true, sort_order: 2 });
    assert.deepEqual(settings, {});
    assert.deepEqual(location, { is_primary: true, sort_order: 2 });
  });

  it("covers exactly the per-clinic settings", () => {
    assert.deepEqual([...CLINIC_SETTINGS_COLUMNS].sort(), [
      "break_end",
      "break_start",
      "end_time",
      "friday",
      "label",
      "monday",
      "pause_online_bookings",
      "saturday",
      "slot_duration_minutes",
      "start_time",
      "sunday",
      "thursday",
      "tuesday",
      "wednesday",
      "weekly_schedule",
    ]);
  });
});
