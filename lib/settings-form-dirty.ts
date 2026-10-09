import type { WeeklySchedule } from "@/lib/doctor-settings";

export type SettingsDirtySnapshot = {
  specialty: string;
  specialtyFromMaster: boolean;
  bio: string;
  languages: string[];
  bookingHorizonDays: number;
  minimumNoticeHours: number;
  patientCancelNoticeHours: number;
  holidayModeEnabled: boolean;
  holidayStartInput: string;
  holidayEndInput: string;
  // The personal mobile and its "show on my profile" switch are not here either: they
  // save through their own route (components/dashboard/settings/PersonalMobileCard.tsx).
  //
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
  bookingHorizonDays: number;
  minimumNoticeHours: number;
  patientCancelNoticeHours: number;
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
    bookingHorizonDays: input.bookingHorizonDays,
    minimumNoticeHours: input.minimumNoticeHours,
    patientCancelNoticeHours: input.patientCancelNoticeHours,
    holidayModeEnabled: input.holidayModeEnabled,
    holidayStartInput: input.holidayStartInput.trim(),
    holidayEndInput: input.holidayEndInput.trim(),
    workplaces: input.workplaces,
  };
}

/**
 * What a save can change. A clinic's address is read-only in settings (clinics are
 * curated by DocCy) and the form keeps it from two sources, so it never counts.
 */
function comparable(snapshot: SettingsDirtySnapshot) {
  return {
    ...snapshot,
    workplaces: snapshot.workplaces.map((row) => ({
      id: row.id,
      label: row.label,
      weeklySchedule: row.weeklySchedule,
      breakEnabled: row.breakEnabled,
      breakStart: row.breakStart,
      breakEnd: row.breakEnd,
      slotDurationMinutes: row.slotDurationMinutes,
    })),
  };
}

export function settingsDirtySnapshotsEqual(
  a: SettingsDirtySnapshot,
  b: SettingsDirtySnapshot,
): boolean {
  return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
}

export function settingsFormHasUnsavedChanges(
  current: SettingsDirtySnapshot,
  saved: SettingsDirtySnapshot,
): boolean {
  return !settingsDirtySnapshotsEqual(current, saved);
}

const SECTION_FIELDS: Array<[UnsavedSection, Array<keyof SettingsDirtySnapshot>]> = [
  // Booking limits are set on each clinic's card; holiday mode pauses every clinic and
  // lives in Clinics on phones (user, 2026-10-09).
  [
    "clinics",
    [
      "workplaces",
      "bookingHorizonDays",
      "minimumNoticeHours",
      "patientCancelNoticeHours",
      "holidayModeEnabled",
      "holidayStartInput",
      "holidayEndInput",
    ],
  ],
  ["profile", ["specialty", "specialtyFromMaster", "bio", "languages"]],
];

export type UnsavedSection = "clinics" | "profile";

/** Which settings sections hold the unsaved changes, in sidebar order (for the save bar). */
export function unsavedSettingsSections(
  current: SettingsDirtySnapshot,
  saved: SettingsDirtySnapshot,
): UnsavedSection[] {
  const a = comparable(current);
  const b = comparable(saved);
  return SECTION_FIELDS.filter(([, fields]) =>
    fields.some((field) => JSON.stringify(a[field]) !== JSON.stringify(b[field])),
  ).map(([section]) => section);
}
