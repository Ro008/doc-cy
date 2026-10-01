/**
 * Settings → Notifications (user, 2026-10-01): which emails the professional gets, a
 * second address that gets them too (e.g. reception), and a reminder to patients.
 *
 * Nothing here is configurable on the server yet. The defaults are what DocCy does
 * today (new requests, confirmed copies and the monthly summary always go; there is
 * no daily summary and no patient reminder), and saving waits for Livio's
 * PUT /api/doctor-notification-settings (docs/handoff/settings-redesign.md).
 * Security emails (a new sign-in) always go and are not listed.
 */

export type NotificationEmailKey = "newRequest" | "confirmedCopy" | "dailySummary" | "monthlySummary";

export type NotificationSettings = {
  emails: Record<NotificationEmailKey, boolean>;
  /** Also send them here; "" = only the account email. */
  extraEmail: string;
  patientReminder: { enabled: boolean; hoursBefore: 24 | 2 };
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emails: { newRequest: true, confirmedCopy: true, dailySummary: false, monthlySummary: true },
  extraEmail: "",
  patientReminder: { enabled: false, hoursBefore: 24 },
};

export const NOTIFICATION_EMAILS: ReadonlyArray<{ key: NotificationEmailKey; label: string; hint: string }> = [
  {
    key: "newRequest",
    label: "New appointment requests",
    hint: "When a patient asks for a time. Confirm or decline from the email or your agenda.",
  },
  {
    key: "confirmedCopy",
    label: "Confirmed appointments",
    hint: "A copy of each confirmed visit, with Add to calendar buttons.",
  },
  {
    key: "dailySummary",
    label: "Tomorrow’s appointments",
    hint: "One email each evening with the next day’s visits.",
  },
  {
    key: "monthlySummary",
    label: "Monthly summary",
    hint: "How DocCy worked for your practice last month.",
  },
];

export const PATIENT_REMINDER_OPTIONS: ReadonlyArray<{ hours: 24 | 2; label: string }> = [
  { hours: 24, label: "24 hours before" },
  { hours: 2, label: "2 hours before" },
];

/** Why the second address cannot be saved, or null. */
export function validateExtraEmail(value: string, accountEmail: string): string | null {
  const email = value.trim();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  if (email.toLowerCase() === accountEmail.trim().toLowerCase()) return "That is already your account email.";
  return null;
}
