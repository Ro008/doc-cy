import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLINIC_SETTINGS_COLUMNS,
  clinicChangeContactMessage,
  clinicSettingsPatch,
  settingsSaveTargets,
} from "../../lib/professional-clinic-settings-writes";

/**
 * A professional's own settings at a clinic (hours, breaks, slot length, label,
 * bookings pause) are written to their professional_clinics row.
 *
 * D4 (user, 2026-09-30): the clinic itself — which one, and its address — is read-only
 * in settings until the clinic join/leave/create/edit requests exist. Clinics are
 * curated by DocCy, so a settings save never carries an address anywhere.
 */

describe("clinicSettingsPatch", () => {
  it("keeps the per-clinic settings and drops the address", () => {
    const settings = clinicSettingsPatch({
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
  });

  it("never lets identity, ownership, linkage or bookkeeping through", () => {
    const settings = clinicSettingsPatch({
      updated_at: "2026-09-23T07:00:00.000Z",
      id: "loc-1",
      doctor_id: "pro-1",
      professional_id: "pro-1",
      clinic_id: "clinic-1",
      is_primary: true,
      sort_order: 2,
      slot_duration_minutes: 30,
    });
    assert.deepEqual(settings, { slot_duration_minutes: 30 });
  });

  it("skips undefined values", () => {
    assert.deepEqual(clinicSettingsPatch({ pause_online_bookings: undefined, label: null }), {
      label: null,
    });
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

const OWNED = [
  { id: "clinic-a", is_primary: true, sort_order: 0 },
  { id: "clinic-b", is_primary: false, sort_order: 1 },
];

const WEEK = {
  monday: { enabled: true, start_time: "14:00", end_time: "18:00" },
  tuesday: { enabled: false, start_time: "09:00", end_time: "17:00" },
  wednesday: { enabled: false, start_time: "09:00", end_time: "17:00" },
  thursday: { enabled: false, start_time: "09:00", end_time: "17:00" },
  friday: { enabled: false, start_time: "09:00", end_time: "17:00" },
  saturday: { enabled: false, start_time: "09:00", end_time: "17:00" },
  sunday: { enabled: false, start_time: "09:00", end_time: "17:00" },
};

describe("settingsSaveTargets", () => {
  it("saves each owned clinic's hours and name, and never its address", () => {
    const targets = settingsSaveTargets(
      [
        {
          id: "clinic-a",
          label: "  Afternoons  ",
          weeklySchedule: WEEK,
          slotDurationMinutes: 50,
          clinicAddress: "Somewhere Else 1, Limassol, Cyprus",
          district: "Limassol",
          clinicLatitude: 34.68,
          clinicLongitude: 33.04,
          clinicPlaceId: "other-place",
          town: "Limassol",
        },
        { id: "clinic-b", slotDurationMinutes: 20 },
      ],
      OWNED,
    );

    assert.deepEqual(
      targets.map((t) => t.locationId),
      ["clinic-a", "clinic-b"],
    );
    const [a, b] = targets;
    assert.equal(a!.settings.label, "Afternoons");
    assert.equal(a!.settings.slot_duration_minutes, 50);
    assert.equal(a!.settings.monday, true);
    assert.equal(a!.settings.start_time, "09:00:00");
    assert.equal(b!.settings.slot_duration_minutes, 20);
    for (const t of targets) {
      for (const key of Object.keys(t.settings)) {
        assert.ok(
          (CLINIC_SETTINGS_COLUMNS as readonly string[]).includes(key),
          `${key} is not a per-clinic setting`,
        );
      }
    }
  });

  it("leaves the name alone when the form did not send one", () => {
    const [target] = settingsSaveTargets([{ id: "clinic-b", slotDurationMinutes: 20 }], OWNED);
    assert.equal("label" in target!.settings, false);
  });

  it("never touches the bookings pause (it has its own toggle)", () => {
    const [target] = settingsSaveTargets(
      [{ id: "clinic-a", slotDurationMinutes: 30, pauseOnlineBookings: false }],
      OWNED,
    );
    assert.equal("pause_online_bookings" in target!.settings, false);
  });

  it("sends a first entry with no id to the primary clinic", () => {
    const targets = settingsSaveTargets(
      [{ slotDurationMinutes: 25 }],
      [OWNED[1]!, OWNED[0]!],
    );
    assert.deepEqual(
      targets.map((t) => t.locationId),
      ["clinic-a"],
    );
  });

  it("skips clinics the professional does not own", () => {
    const targets = settingsSaveTargets(
      [
        { id: "someone-elses-clinic", slotDurationMinutes: 10 },
        { id: "clinic-b", slotDurationMinutes: 15 },
      ],
      OWNED,
    );
    assert.deepEqual(
      targets.map((t) => t.locationId),
      ["clinic-b"],
    );
  });

  it("saves nothing when the professional has no clinic", () => {
    assert.deepEqual(settingsSaveTargets([{ slotDurationMinutes: 25 }], []), []);
  });
});

describe("clinicChangeContactMessage", () => {
  it("names the only clinic", () => {
    assert.equal(
      clinicChangeContactMessage(["Golden Recovery"]),
      'Hello, I would like to change my clinic "Golden Recovery". The change is: ',
    );
  });

  it("stays general with several clinics or none", () => {
    const expected = "Hello, I would like to change my clinics. The change is: ";
    assert.equal(clinicChangeContactMessage(["A", "B"]), expected);
    assert.equal(clinicChangeContactMessage([]), expected);
    assert.equal(clinicChangeContactMessage(["", "  "]), expected);
  });
});
