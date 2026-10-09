/** The settings page's sidebar (design B1): one section on screen at a time, kept in `?section=`. */

export const SETTINGS_SECTIONS = [
  // No "Availability" section: it only repeated each clinic card's status (user, 2026-10-09).
  // Old `?section=availability` links fall back to the default, Clinics.
  { id: "clinics", label: "Clinics" },
  { id: "services", label: "Services & prices" },
  { id: "profile", label: "Profile" },
  { id: "contact", label: "Contact & phone" },
  // QR, print sign and scripts: their own section, not part of Account (user, 2026-10-01).
  { id: "promote", label: "Promote" },
  // The professional's own terms: free period, price after it (user, 2026-10-01).
  { id: "plan", label: "Plan & billing" },
  { id: "account", label: "Account" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = "clinics";

/** Settings is its own page, not part of the agenda (user, 2026-09-30). */
export const SETTINGS_PATH = "/settings";

export function parseSettingsSection(
  raw: string | readonly string[] | null | undefined,
): SettingsSectionId {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const value = String(first ?? "").trim().toLowerCase();
  const match = SETTINGS_SECTIONS.find((section) => section.id === value);
  return match ? match.id : DEFAULT_SETTINGS_SECTION;
}

export function settingsSectionHref(section: SettingsSectionId): string {
  return section === DEFAULT_SETTINGS_SECTION
    ? SETTINGS_PATH
    : `${SETTINGS_PATH}?section=${section}`;
}

/** Old `/agenda/settings` links (emails, bookmarks) land on the same section. */
export function legacySettingsRedirect(searchParams: {
  section?: string | readonly string[] | null;
}): string {
  return settingsSectionHref(parseSettingsSection(searchParams.section));
}
