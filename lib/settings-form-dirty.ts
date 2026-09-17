import type { WeeklySchedule } from "@/lib/doctor-settings";
import type { PublicPhoneSource } from "@/lib/public-call-phone";

export type SettingsDirtySnapshot = {
  specialty: string;
  specialtyFromMaster: boolean;
  bio: string;
  languages: string[];
  mobileNumber: string;
  directoryPhone: string;
  showPhonePublic: boolean;
  publicPhoneSource: PublicPhoneSource;
  bookingHorizonDays: number;
  minimumNoticeHours: number;
  holidayModeEnabled: boolean;
  holidayStartInput: string;
  holidayEndInput: string;
  // pauseOnlineBookings is intentionally excluded: the toggle saves itself through
  // its own API call, so including it here produces a false "unsaved changes"
  // warning the instant a professional flips it.
  //
  // Clinic-scoped fields (district, address, hours, break, slot duration) live only
  // here, per clinic — never mirrored at the top level. The form keeps a single
  // shared set of input fields that gets repointed at whichever clinic tab is
  // active, so a top-level mirror would just reflect "whichever tab is open now"
  // and flag a false edit on every tab switch, even with nothing touched.
  workplaces: Array<{
    id: string;
    label: string;
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
  }>;
};

export function buildSettingsDirtySnapshot(input: {
  specialty: string;
  specialtyFromMaster: boolean;
  bio: string;
  languages: string[];
  mobileNumber: string;
  directoryPhone: string;
  showPhonePublic: boolean;
  publicPhoneSource: PublicPhoneSource;
  bookingHorizonDays: number;
  minimumNoticeHours: number;
  holidayModeEnabled: boolean;
  holidayStartInput: string;
  holidayEndInput: string;
  workplaces: SettingsDirtySnapshot["workplaces"];
}): SettingsDirtySnapshot {
  return {
    specialty: input.specialty.trim(),
    specialtyFromMaster: input.specialtyFromMaster,
    bio: input.bio.trim(),
    languages: [...input.languages].map((l) => l.trim()).filter(Boolean).sort(),
    mobileNumber: input.mobileNumber.trim(),
    directoryPhone: input.directoryPhone.trim(),
    showPhonePublic: input.showPhonePublic,
    publicPhoneSource: input.publicPhoneSource,
    bookingHorizonDays: input.bookingHorizonDays,
    minimumNoticeHours: input.minimumNoticeHours,
    holidayModeEnabled: input.holidayModeEnabled,
    holidayStartInput: input.holidayStartInput.trim(),
    holidayEndInput: input.holidayEndInput.trim(),
    workplaces: input.workplaces,
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
