import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WeeklySchedule } from "../../lib/doctor-settings";
import { buildSettingsDirtySnapshot, type SettingsDirtySnapshot } from "../../lib/settings-form-dirty";
import {
  applySaveGroup,
  buildSettingsSavePayload,
  saveGroupHasChanges,
  validateSettingsToSave,
} from "../../lib/settings-save-groups";

/**
 * One save rule for settings (user, 2026-10-01): small controls save at once, bigger
 * editors (a clinic's hours, the bio, the mobile, holiday dates) have their own Save.
 * The API replaces everything it is sent, so each save sends the last saved settings
 * with only that block changed: nothing else half-edited goes out with it.
 */

const day = (enabled: boolean, start = "09:00", end = "17:00") => ({ enabled, start_time: start, end_time: end });
const week = (from: string): WeeklySchedule => ({
  monday: day(true, from),
  tuesday: day(true, from),
  wednesday: day(true, from),
  thursday: day(true, from),
  friday: day(true, from),
  saturday: day(false),
  sunday: day(false),
});

function clinic(id: string, from: string, slot: number) {
  return {
    id,
    label: id,
    district: "Limassol",
    clinicAddress: `${id} street`,
    clinicLatitude: 34.6,
    clinicLongitude: 33.0,
    clinicPlaceId: null,
    weeklySchedule: week(from),
    breakEnabled: true,
    breakStart: "13:00",
    breakEnd: "14:00",
    slotDurationMinutes: slot,
  };
}

function snapshot(patch: Partial<Parameters<typeof buildSettingsDirtySnapshot>[0]> = {}): SettingsDirtySnapshot {
  return buildSettingsDirtySnapshot({
    specialty: "Dermatology",
    specialtyFromMaster: true,
    bio: "Skin doctor.",
    languages: ["English", "Greek"],
    mobileNumber: "+35799111222",
    bookingHorizonDays: 30,
    minimumNoticeHours: 24,
    holidayModeEnabled: false,
    holidayStartInput: "",
    holidayEndInput: "",
    workplaces: [clinic("a", "09:00", 30), clinic("b", "10:00", 45)],
    ...patch,
  });
}

describe("applySaveGroup", () => {
  const saved = snapshot();
  const current = snapshot({
    bio: "Half-written new bio",
    bookingHorizonDays: 90,
    minimumNoticeHours: 2,
    workplaces: [clinic("a", "08:00", 20), clinic("b", "11:00", 60)],
  });

  it("takes only the booking limits", () => {
    const next = applySaveGroup(saved, current, { kind: "limits" });
    assert.equal(next.bookingHorizonDays, 90);
    assert.equal(next.minimumNoticeHours, 2);
    assert.equal(next.bio, "Skin doctor.");
    assert.deepEqual(next.workplaces, saved.workplaces);
  });

  it("takes one clinic's hours and leaves the other as saved", () => {
    const next = applySaveGroup(saved, current, { kind: "clinic", id: "a" });
    assert.equal(next.workplaces[0]?.slotDurationMinutes, 20);
    assert.equal(next.workplaces[0]?.weeklySchedule.monday.start_time, "08:00");
    assert.deepEqual(next.workplaces[1], saved.workplaces[1]);
    assert.equal(next.bookingHorizonDays, 30);
  });

  it("takes the bio, the languages, the mobile or holiday mode alone", () => {
    assert.equal(applySaveGroup(saved, current, { kind: "bio" }).bio, "Half-written new bio");
    assert.equal(applySaveGroup(saved, current, { kind: "bio" }).bookingHorizonDays, 30);
    const holiday = applySaveGroup(
      saved,
      snapshot({ holidayModeEnabled: true, holidayStartInput: "01/12/2026", holidayEndInput: "10/12/2026" }),
      { kind: "holiday" },
    );
    assert.equal(holiday.holidayModeEnabled, true);
    assert.equal(holiday.holidayStartInput, "01/12/2026");
  });
});

describe("saveGroupHasChanges", () => {
  it("is true only for the block that changed", () => {
    const saved = snapshot();
    const current = snapshot({ workplaces: [clinic("a", "08:00", 30), clinic("b", "10:00", 45)] });
    assert.equal(saveGroupHasChanges(saved, current, { kind: "clinic", id: "a" }), true);
    assert.equal(saveGroupHasChanges(saved, current, { kind: "clinic", id: "b" }), false);
    assert.equal(saveGroupHasChanges(saved, current, { kind: "bio" }), false);
  });

  it("ignores a clinic's address (read-only, kept from two sources)", () => {
    const saved = snapshot();
    const moved = { ...clinic("a", "09:00", 30), clinicAddress: "elsewhere" };
    const current = snapshot({ workplaces: [moved, clinic("b", "10:00", 45)] });
    assert.equal(saveGroupHasChanges(saved, current, { kind: "clinic", id: "a" }), false);
  });
});

describe("validateSettingsToSave", () => {
  it("needs a language", () => {
    assert.equal(validateSettingsToSave(snapshot({ languages: [] })), "Choose at least one language.");
  });

  it("caps the bio", () => {
    assert.equal(
      validateSettingsToSave(snapshot({ bio: "x".repeat(1001) })),
      "Keep your bio under 1000 characters.",
    );
  });

  it("needs valid, ordered holiday dates when holiday mode is on", () => {
    assert.equal(
      validateSettingsToSave(snapshot({ holidayModeEnabled: true, holidayStartInput: "1/12", holidayEndInput: "" })),
      "Pick both holiday dates.",
    );
    assert.equal(
      validateSettingsToSave(
        snapshot({ holidayModeEnabled: true, holidayStartInput: "10/12/2026", holidayEndInput: "01/12/2026" }),
      ),
      "The holiday must end on or after the day it starts.",
    );
    assert.equal(
      validateSettingsToSave(
        snapshot({ holidayModeEnabled: true, holidayStartInput: "01/12/2026", holidayEndInput: "10/12/2026" }),
      ),
      null,
    );
  });
});

describe("buildSettingsSavePayload", () => {
  it("sends every setting the API replaces, from one snapshot", () => {
    const payload = buildSettingsSavePayload(
      "doc-1",
      snapshot({ holidayModeEnabled: true, holidayStartInput: "01/12/2026", holidayEndInput: "10/12/2026" }),
    );
    assert.equal(payload.doctorId, "doc-1");
    assert.equal(payload.doctorPhone, "+35799111222");
    assert.equal(payload.bio, "Skin doctor.");
    assert.deepEqual(payload.languages, ["English", "Greek"]);
    assert.equal(payload.bookingHorizonDays, 30);
    assert.equal(payload.minimumNoticeHours, 24);
    assert.equal(payload.holidayModeEnabled, true);
    assert.equal(payload.holidayStartDate, "2026-12-01");
    assert.equal(payload.holidayEndDate, "2026-12-10");
    assert.equal((payload.locations as unknown[]).length, 2);
  });

  it("mirrors the first clinic's hours at the top level (account settings follow the primary)", () => {
    const payload = buildSettingsSavePayload("doc-1", snapshot());
    assert.equal(payload.slotDurationMinutes, 30);
    assert.equal(payload.monday, true);
    assert.equal(payload.saturday, false);
    assert.equal((payload.weeklySchedule as WeeklySchedule).monday.start_time, "09:00");
  });

  it("sends each clinic's hours without its name or address", () => {
    const [first] = buildSettingsSavePayload("doc-1", snapshot()).locations as Record<string, unknown>[];
    assert.equal(first?.id, "a");
    assert.equal(first?.slotDurationMinutes, 30);
    assert.equal("label" in (first ?? {}), false);
    assert.equal("clinicAddress" in (first ?? {}), false);
  });

  it("sends no holiday dates while holiday mode is off", () => {
    const payload = buildSettingsSavePayload("doc-1", snapshot());
    assert.equal(payload.holidayStartDate, null);
    assert.equal(payload.holidayEndDate, null);
  });
});
