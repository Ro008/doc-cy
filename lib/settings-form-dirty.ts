import type { WeeklySchedule } from "@/lib/doctor-settings";
import type { ClinicLocation } from "@/lib/clinic-location";

export type SettingsDirtySnapshot = {
  specialty: string;
  specialtyFromMaster: boolean;
  bio: string;
  languages: string[];
  whatsappNumber: string;
  showPhonePublic: boolean;
  district: string;
  clinicAddress: string;
  clinicLatitude: number | null;
  clinicLongitude: number | null;
  clinicPlaceId: string | null;
  weeklySchedule: WeeklySchedule;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
  slotDurationMinutes: number;
  bookingHorizonDays: number;
  minimumNoticeHours: number;
  holidayModeEnabled: boolean;
  holidayStartInput: string;
  holidayEndInput: string;
};

export function buildSettingsDirtySnapshot(input: {
  specialty: string;
  specialtyFromMaster: boolean;
  bio: string;
  languages: string[];
  whatsappNumber: string;
  showPhonePublic: boolean;
  district: string;
  clinicLocation: ClinicLocation;
  weeklySchedule: WeeklySchedule;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
  slotDurationMinutes: number;
  bookingHorizonDays: number;
  minimumNoticeHours: number;
  holidayModeEnabled: boolean;
  holidayStartInput: string;
  holidayEndInput: string;
}): SettingsDirtySnapshot {
  return {
    specialty: input.specialty.trim(),
    specialtyFromMaster: input.specialtyFromMaster,
    bio: input.bio.trim(),
    languages: [...input.languages].map((l) => l.trim()).filter(Boolean).sort(),
    whatsappNumber: input.whatsappNumber.trim(),
    showPhonePublic: input.showPhonePublic,
    district: input.district.trim(),
    clinicAddress: input.clinicLocation.address.trim(),
    clinicLatitude: input.clinicLocation.latitude ?? null,
    clinicLongitude: input.clinicLocation.longitude ?? null,
    clinicPlaceId: input.clinicLocation.placeId?.trim() || null,
    weeklySchedule: input.weeklySchedule,
    breakEnabled: input.breakEnabled,
    breakStart: input.breakStart.trim(),
    breakEnd: input.breakEnd.trim(),
    slotDurationMinutes: input.slotDurationMinutes,
    bookingHorizonDays: input.bookingHorizonDays,
    minimumNoticeHours: input.minimumNoticeHours,
    holidayModeEnabled: input.holidayModeEnabled,
    holidayStartInput: input.holidayStartInput.trim(),
    holidayEndInput: input.holidayEndInput.trim(),
  };
}

export function settingsDirtySnapshotsEqual(
  a: SettingsDirtySnapshot,
  b: SettingsDirtySnapshot,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function settingsFormHasUnsavedChanges(
  current: SettingsDirtySnapshot,
  saved: SettingsDirtySnapshot,
): boolean {
  return !settingsDirtySnapshotsEqual(current, saved);
}
