import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSettingsDirtySnapshot,
  settingsFormHasUnsavedChanges,
} from "../../lib/settings-form-dirty";
import type { WeeklySchedule } from "@/lib/doctor-settings";

const weeklySchedule: WeeklySchedule = {
  monday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
  tuesday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
  wednesday: { enabled: false, start_time: "09:00:00", end_time: "17:00:00" },
  thursday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
  friday: { enabled: true, start_time: "09:00:00", end_time: "17:00:00" },
  saturday: { enabled: false, start_time: "09:00:00", end_time: "13:00:00" },
  sunday: { enabled: false, start_time: "09:00:00", end_time: "13:00:00" },
};

const baseWorkplace = {
  id: "primary",
  label: "",
  district: "Nicosia",
  clinicAddress: "1 Clinic St, Nicosia",
  clinicLatitude: 35.1,
  clinicLongitude: 33.3,
  clinicPlaceId: "place-1",
  weeklySchedule,
  breakEnabled: false,
  breakStart: "13:00",
  breakEnd: "14:00",
  slotDurationMinutes: 30,
};

function baseSnapshotInput() {
  return {
    specialty: "General Practice",
    specialtyFromMaster: true,
    bio: "Helping patients across Cyprus.",
    languages: ["English", "Greek"],
    mobileNumber: "+35799111222",
    directoryPhone: "",
    showPhonePublic: false,
    publicPhoneSource: "mobile" as const,
    bookingHorizonDays: 60,
    minimumNoticeHours: 24,
    holidayModeEnabled: false,
    holidayStartInput: "",
    holidayEndInput: "",
    workplaces: [baseWorkplace],
  };
}

describe("settings-form-dirty", () => {
  it("treats identical snapshots as saved", () => {
    const saved = buildSettingsDirtySnapshot(baseSnapshotInput());
    const current = buildSettingsDirtySnapshot(baseSnapshotInput());
    assert.equal(settingsFormHasUnsavedChanges(current, saved), false);
  });

  it("detects schedule and clinic edits on a workplace", () => {
    const saved = buildSettingsDirtySnapshot(baseSnapshotInput());
    const changedSchedule = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      workplaces: [
        {
          ...baseWorkplace,
          weeklySchedule: {
            ...weeklySchedule,
            monday: { enabled: false, start_time: "09:00:00", end_time: "17:00:00" },
          },
        },
      ],
    });
    assert.equal(settingsFormHasUnsavedChanges(changedSchedule, saved), true);

    const changedClinic = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      workplaces: [{ ...baseWorkplace, clinicAddress: "2 Other St, Limassol" }],
    });
    assert.equal(settingsFormHasUnsavedChanges(changedClinic, saved), true);
  });

  it("does not flag a switch between clinic tabs as an edit", () => {
    // The active clinic's fields get re-captured into `workplaces` on every tab
    // switch (via captureActiveWorkplace), even when the visiting tab itself is
    // untouched. As long as neither workplace's own data changed, that must not
    // read as dirty.
    const secondWorkplace = {
      ...baseWorkplace,
      id: "clinic-2",
      district: "Limassol",
      clinicAddress: "9 Other Ave, Limassol",
    };
    const saved = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      workplaces: [baseWorkplace, secondWorkplace],
    });
    const current = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      workplaces: [baseWorkplace, secondWorkplace],
    });
    assert.equal(settingsFormHasUnsavedChanges(current, saved), false);
  });

  it("detects phone visibility edits", () => {
    const saved = buildSettingsDirtySnapshot(baseSnapshotInput());
    const changed = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      showPhonePublic: true,
    });
    assert.equal(settingsFormHasUnsavedChanges(changed, saved), true);
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
