import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  clinicAddressFirstLine,
  clinicDefaultName,
  clinicDisplayName,
  clinicTitleOrFallback,
  doctorLocationDisplayName,
  locationToSettingsRow,
  profileClinicAccent,
  sanitizeClinicLabel,
  sortDoctorLocations,
  workplaceAccent,
} from "../../lib/doctor-locations";
import type { DoctorLocationRow } from "../../lib/doctor-locations";

function loc(partial: Partial<DoctorLocationRow> & { id: string }): DoctorLocationRow {
  return {
    doctor_id: "doc-1",
    is_primary: false,
    sort_order: 0,
    label: null,
    district: "Nicosia",
    clinic_address: null,
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
    weekly_schedule: null,
    break_start: null,
    break_end: null,
    slot_duration_minutes: 30,
    ...partial,
  };
}

describe("doctor locations", () => {
  it("defaults clinic names to Clinic 1 / Clinic 2 unless a custom label is set", () => {
    assert.equal(clinicDefaultName(0, 1), "Clinic 1");
    assert.equal(clinicDefaultName(0, 2), "Clinic 1");
    assert.equal(clinicDefaultName(1, 2), "Clinic 2");
    assert.equal(clinicDisplayName("  ", 0, 2), "Clinic 1");
    assert.equal(clinicDisplayName("Evangelismos", 0, 2), "Evangelismos");
    assert.equal(sanitizeClinicLabel("   "), null);
    assert.equal(clinicTitleOrFallback(null, "Κλινική 1"), "Κλινική 1");
    assert.equal(clinicTitleOrFallback("Makarios", "Κλινική 1"), "Makarios");
    assert.equal(
      doctorLocationDisplayName(
        loc({ id: "a", clinic_address: "12 Ledra Street, Nicosia" }),
        0,
        2,
      ),
      "Clinic 1",
    );
    assert.equal(
      doctorLocationDisplayName(
        loc({ id: "a", label: "Ledra clinic", clinic_address: "12 Ledra Street, Nicosia" }),
        0,
        2,
      ),
      "Ledra clinic",
    );
  });

  it("gives each workplace a distinct settings-frame color", () => {
    assert.equal(workplaceAccent(0).frame.includes("clinical-400"), true);
    assert.equal(workplaceAccent(1).frame.includes("violet-400"), true);
    assert.notEqual(workplaceAccent(0).frame, workplaceAccent(1).frame);
    assert.equal(workplaceAccent(5).frame, workplaceAccent(0).frame);
    assert.equal(profileClinicAccent(0).selected.includes("clinical-"), true);
    assert.equal(profileClinicAccent(1).selected.includes("violet-"), true);
    assert.notEqual(profileClinicAccent(0).selected, profileClinicAccent(1).selected);
    assert.equal(clinicAddressFirstLine("12 Ledra Street, Nicosia"), "12 Ledra Street, Nicosia");

    const settingsForm = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../components/dashboard/SettingsForm.tsx"),
      "utf8",
    );
    assert.equal(settingsForm.includes("workplace-settings-frame"), true);
    assert.equal(settingsForm.includes("workplaceAccent"), true);
    assert.equal(settingsForm.includes("Hours for ${activeWorkplaceLabel}"), true);
    assert.equal(settingsForm.includes('id="clinicName"'), true);
    assert.equal(settingsForm.includes("Add clinic"), true);
    assert.equal(settingsForm.includes("Add workplace"), false);
    assert.equal(settingsForm.includes('aria-label="Clinics"'), true);
    assert.equal(settingsForm.includes('id="district"'), false);
    assert.equal(settingsForm.includes("Select district"), false);
    assert.equal(settingsForm.includes("settings-clinic-district"), false);
    assert.equal(settingsForm.includes("District not detected"), true);
    assert.equal(workplaceAccent(0).tabSelected.includes("rounded-t-xl"), true);
    assert.equal(
      settingsForm.indexOf('role="tablist"') <
        settingsForm.indexOf("workplace-settings-frame"),
      true,
    );
    assert.equal(settingsForm.includes("overflow-x-auto px-1"), false);
    assert.equal(settingsForm.includes("TIME_INPUT_CLASS"), true);
    assert.equal(settingsForm.includes("[overflow-anchor:none]"), true);
    assert.equal(settingsForm.includes("workplaceTabScrollYRef"), true);
    const picker = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../components/doctor/DoctorProfileClinicPicker.tsx"),
      "utf8",
    );
    const profilePage = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../lib/public/doctor-profile-page.tsx"),
      "utf8",
    );
    assert.equal(picker.includes("profile-clinic-picker"), true);
    assert.equal(picker.includes("chooseClinicHeading"), true);
    assert.equal(picker.includes("clinicTitleOrFallback"), true);
    assert.equal(profilePage.includes("DoctorProfileClinicPicker"), true);
    assert.equal(profilePage.includes('aria-label="Workplaces"'), false);
  });

  it("keeps the primary workplace first", () => {
    const sorted = sortDoctorLocations([
      loc({ id: "b", is_primary: false, sort_order: 1 }),
      loc({ id: "a", is_primary: true, sort_order: 0 }),
    ]);
    assert.equal(sorted[0]?.id, "a");
    assert.equal(sorted[1]?.id, "b");
  });

  it("merges location pause onto global holiday settings", () => {
    const merged = locationToSettingsRow(
      loc({ id: "lim", pause_online_bookings: true, district: "Limassol" }),
      {
        show_phone_public: false,
        holiday_mode_enabled: true,
        holiday_start_date: "2026-08-01",
        holiday_end_date: "2026-08-10",
        booking_horizon_days: 90,
        minimum_notice_hours: 2,
      },
    );
    assert.equal(merged.pause_online_bookings, true);
    assert.equal(merged.holiday_mode_enabled, true);
    assert.equal(merged.holiday_start_date, "2026-08-01");
  });
});
