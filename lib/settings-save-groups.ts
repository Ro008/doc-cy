import { parseDDMMYYYYToISO } from "@/lib/date-format";
import type { SettingsDirtySnapshot } from "@/lib/settings-form-dirty";

/**
 * One save rule for settings (user, 2026-10-01): small controls (booking limits and
 * the online cancellation deadline,
 * languages, turning holiday mode off) save at once; bigger editors (a clinic's hours,
 * the bio, the mobile, holiday dates) have their own Save. There is no page-wide
 * "Save settings" any more.
 *
 * POST /api/doctor-settings replaces everything it is sent (unchanged API), so a save
 * sends the LAST SAVED settings with only one block taken from the form: nothing
 * else the doctor is half-way through editing goes out with it.
 */

export type SaveGroup =
  | { kind: "limits" }
  | { kind: "holiday" }
  | { kind: "bio" }
  | { kind: "languages" }
  | { kind: "mobile" }
  | { kind: "clinic"; id: string };

const GROUP_FIELDS: Record<Exclude<SaveGroup["kind"], "clinic">, Array<keyof SettingsDirtySnapshot>> = {
  limits: ["bookingHorizonDays", "minimumNoticeHours", "patientCancelNoticeHours"],
  holiday: ["holidayModeEnabled", "holidayStartInput", "holidayEndInput"],
  bio: ["bio"],
  languages: ["languages"],
  mobile: ["mobileNumber"],
};

type Workplace = SettingsDirtySnapshot["workplaces"][number];

/** What a save of a clinic can change: its hours, break and slot (never its address). */
function clinicHours(row: Workplace | undefined) {
  if (!row) return null;
  return {
    weeklySchedule: row.weeklySchedule,
    breakEnabled: row.breakEnabled,
    breakStart: row.breakStart,
    breakEnd: row.breakEnd,
    slotDurationMinutes: row.slotDurationMinutes,
  };
}

/** The saved settings with one block taken from the form. */
export function applySaveGroup(
  saved: SettingsDirtySnapshot,
  current: SettingsDirtySnapshot,
  group: SaveGroup,
): SettingsDirtySnapshot {
  if (group.kind === "clinic") {
    const draft = current.workplaces.find((row) => row.id === group.id);
    const hours = clinicHours(draft);
    if (!hours) return saved;
    return {
      ...saved,
      workplaces: saved.workplaces.map((row) => (row.id === group.id ? { ...row, ...hours } : row)),
    };
  }
  const next = { ...saved } as Record<string, unknown>;
  for (const field of GROUP_FIELDS[group.kind]) next[field] = current[field];
  return next as SettingsDirtySnapshot;
}

export function saveGroupHasChanges(
  saved: SettingsDirtySnapshot,
  current: SettingsDirtySnapshot,
  group: SaveGroup,
): boolean {
  if (group.kind === "clinic") {
    const a = clinicHours(saved.workplaces.find((row) => row.id === group.id));
    const b = clinicHours(current.workplaces.find((row) => row.id === group.id));
    return JSON.stringify(a) !== JSON.stringify(b);
  }
  return GROUP_FIELDS[group.kind].some(
    (field) => JSON.stringify(saved[field]) !== JSON.stringify(current[field]),
  );
}

export const SETTINGS_BIO_MAX_CHARS = 1000;

/** Why these settings cannot be saved, or null. */
export function validateSettingsToSave(snapshot: SettingsDirtySnapshot): string | null {
  if (snapshot.languages.filter((l) => l.trim()).length === 0) return "Choose at least one language.";
  if (snapshot.bio.trim().length > SETTINGS_BIO_MAX_CHARS) {
    return `Keep your bio under ${SETTINGS_BIO_MAX_CHARS} characters.`;
  }
  if (snapshot.holidayModeEnabled) {
    const start = parseDDMMYYYYToISO(snapshot.holidayStartInput);
    const end = parseDDMMYYYYToISO(snapshot.holidayEndInput);
    if (!start || !end) return "Pick both holiday dates.";
    if (start > end) return "The holiday must end on or after the day it starts.";
  }
  return null;
}

/** The body of POST /api/doctor-settings for these settings. */
export function buildSettingsSavePayload(
  doctorId: string,
  snapshot: SettingsDirtySnapshot,
): Record<string, unknown> {
  // Account-level hours follow the first (primary) clinic, as the API expects.
  const primary = snapshot.workplaces[0];
  const schedule = primary?.weeklySchedule;
  const holidayOn = snapshot.holidayModeEnabled;
  return {
    doctorId,
    doctorPhone: snapshot.mobileNumber || null,
    bio: snapshot.bio.trim(),
    languages: snapshot.languages.filter((l) => l.trim()),
    monday: Boolean(schedule?.monday.enabled),
    tuesday: Boolean(schedule?.tuesday.enabled),
    wednesday: Boolean(schedule?.wednesday.enabled),
    thursday: Boolean(schedule?.thursday.enabled),
    friday: Boolean(schedule?.friday.enabled),
    saturday: Boolean(schedule?.saturday.enabled),
    sunday: Boolean(schedule?.sunday.enabled),
    weeklySchedule: schedule,
    breakEnabled: primary?.breakEnabled ?? false,
    breakStart: primary?.breakStart ?? "",
    breakEnd: primary?.breakEnd ?? "",
    slotDurationMinutes: primary?.slotDurationMinutes,
    bookingHorizonDays: snapshot.bookingHorizonDays,
    minimumNoticeHours: snapshot.minimumNoticeHours,
    patientCancelNoticeHours: snapshot.patientCancelNoticeHours,
    holidayModeEnabled: holidayOn,
    holidayStartDate: holidayOn ? parseDDMMYYYYToISO(snapshot.holidayStartInput) : null,
    holidayEndDate: holidayOn ? parseDDMMYYYYToISO(snapshot.holidayEndInput) : null,
    locations: snapshot.workplaces.map((row) => ({
      id: row.id === "primary" ? undefined : row.id,
      weeklySchedule: row.weeklySchedule,
      monday: row.weeklySchedule.monday.enabled,
      tuesday: row.weeklySchedule.tuesday.enabled,
      wednesday: row.weeklySchedule.wednesday.enabled,
      thursday: row.weeklySchedule.thursday.enabled,
      friday: row.weeklySchedule.friday.enabled,
      saturday: row.weeklySchedule.saturday.enabled,
      sunday: row.weeklySchedule.sunday.enabled,
      breakEnabled: row.breakEnabled,
      breakStart: row.breakStart,
      breakEnd: row.breakEnd,
      slotDurationMinutes: row.slotDurationMinutes,
    })),
  };
}
