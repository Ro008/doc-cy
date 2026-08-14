import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSettingsDirtySnapshot,
  settingsFormHasUnsavedChanges,
} from "../../lib/settings-form-dirty";
import type { WeeklySchedule } from "@/lib/doctor-settings";

const weeklySchedule: WeeklySchedule = {
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "17:00" },
  wednesday: { enabled: false, start: "09:00", end: "17:00" },
  thursday: { enabled: true, start: "09:00", end: "17:00" },
  friday: { enabled: true, start: "09:00", end: "17:00" },
  saturday: { enabled: false, start: "09:00", end: "13:00" },
  sunday: { enabled: false, start: "09:00", end: "13:00" },
};

function baseSnapshotInput() {
  return {
    specialty: "General Practice",
    specialtyFromMaster: true,
    bio: "Helping patients across Cyprus.",
    languages: ["English", "Greek"],
    whatsappNumber: "+35799111222",
    showPhonePublic: false,
    district: "Nicosia",
    clinicLocation: {
      address: "1 Clinic St, Nicosia",
      latitude: 35.1,
      longitude: 33.3,
      placeId: "place-1",
      district: "Nicosia" as const,
      town: "Nicosia",
    },
    weeklySchedule,
    breakEnabled: false,
    breakStart: "13:00",
    breakEnd: "14:00",
    slotDurationMinutes: 30,
    bookingHorizonDays: 60,
    minimumNoticeHours: 24,
    holidayModeEnabled: false,
    holidayStartInput: "",
    holidayEndInput: "",
  };
}

describe("settings-form-dirty", () => {
  it("treats identical snapshots as saved", () => {
    const saved = buildSettingsDirtySnapshot(baseSnapshotInput());
    const current = buildSettingsDirtySnapshot(baseSnapshotInput());
    assert.equal(settingsFormHasUnsavedChanges(current, saved), false);
  });

  it("detects schedule and clinic edits", () => {
    const saved = buildSettingsDirtySnapshot(baseSnapshotInput());
    const changedSchedule = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      weeklySchedule: {
        ...weeklySchedule,
        monday: { enabled: false, start: "09:00", end: "17:00" },
      },
    });
    assert.equal(settingsFormHasUnsavedChanges(changedSchedule, saved), true);

    const changedClinic = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      clinicLocation: {
        ...baseSnapshotInput().clinicLocation,
        address: "2 Other St, Limassol",
      },
    });
    assert.equal(settingsFormHasUnsavedChanges(changedClinic, saved), true);
  });

  it("detects bio edits", () => {
    const saved = buildSettingsDirtySnapshot(baseSnapshotInput());
    const changed = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      bio: "Updated about text.",
    });
    assert.equal(settingsFormHasUnsavedChanges(changed, saved), true);
  });

  it("normalizes language order when comparing", () => {
    const saved = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      languages: ["Greek", "English"],
    });
    const current = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      languages: ["English", "Greek"],
    });
    assert.equal(settingsFormHasUnsavedChanges(current, saved), false);
  });
});
