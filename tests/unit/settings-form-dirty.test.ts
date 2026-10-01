import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSettingsDirtySnapshot,
  settingsFormHasUnsavedChanges,
  unsavedSettingsSections,
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

    const renamedClinic = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      workplaces: [{ ...baseWorkplace, label: "Ledra Clinic" }],
    });
    assert.equal(settingsFormHasUnsavedChanges(renamedClinic, saved), true);
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

  it("detects mobile number edits", () => {
    const saved = buildSettingsDirtySnapshot(baseSnapshotInput());
    const changed = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      mobileNumber: "+35799111333",
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

describe("unsavedSettingsSections", () => {
  const saved = () => buildSettingsDirtySnapshot(baseSnapshotInput());

  it("is empty when nothing changed", () => {
    assert.deepEqual(unsavedSettingsSections(saved(), saved()), []);
  });

  it("names the section each change belongs to, in sidebar order", () => {
    const changed = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      bio: "New bio.",
      mobileNumber: "+35799000000",
      minimumNoticeHours: 48,
      workplaces: [{ ...baseWorkplace, slotDurationMinutes: 45 }],
    });
    assert.deepEqual(unsavedSettingsSections(changed, saved()), [
      "availability",
      "clinics",
      "profile",
      "contact",
    ]);
  });

  it("puts holiday dates under Availability", () => {
    const changed = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      holidayModeEnabled: true,
      holidayStartInput: "01/08/2026",
    });
    assert.deepEqual(unsavedSettingsSections(changed, saved()), ["availability"]);
  });

  it("counts languages as Profile, ignoring their order", () => {
    const reordered = buildSettingsDirtySnapshot({ ...baseSnapshotInput(), languages: ["Greek", "English"] });
    assert.deepEqual(unsavedSettingsSections(reordered, saved()), []);
    const changed = buildSettingsDirtySnapshot({ ...baseSnapshotInput(), languages: ["English"] });
    assert.deepEqual(unsavedSettingsSections(changed, saved()), ["profile"]);
  });
});

describe("clinic address in the dirty check", () => {
  it("never counts the address: it is read-only and not saved from settings", () => {
    const saved = buildSettingsDirtySnapshot(baseSnapshotInput());
    const otherCopy = buildSettingsDirtySnapshot({
      ...baseSnapshotInput(),
      workplaces: [
        {
          ...baseWorkplace,
          district: "Limassol",
          clinicAddress: "2 Other St, Limassol",
          clinicLatitude: null,
          clinicLongitude: null,
          clinicPlaceId: null,
        },
      ],
    });
    assert.equal(settingsFormHasUnsavedChanges(otherCopy, saved), false);
    assert.deepEqual(unsavedSettingsSections(otherCopy, saved), []);
  });
});

