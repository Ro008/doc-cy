/** The settings page's sidebar (design B1): one section on screen at a time, kept in `?section=`. */

// Order (user, 2026-10-09): who I am, where I work, what I offer, bringing patients in;
// then account admin, set apart in the sidebar (`group: "account"`).
// No "Availability" section: it only repeated each clinic card's status (user, 2026-10-09).
// No "Contact & phone" section: each clinic card holds its phone, and the personal mobile
// is in Account (user, 2026-10-10).
export const SETTINGS_SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "clinics", label: "Clinics" },
  { id: "services", label: "Services & prices" },
  // QR, print sign and scripts: their own section, not part of Account (user, 2026-10-01).
  { id: "promote", label: "Promote" },
  // The professional's own terms: free period, price after it (user, 2026-10-01).
  { id: "plan", label: "Plan & billing", group: "account" },
  { id: "account", label: "Account", group: "account" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = "profile";

/** Sections that no longer exist, and where their old links land. */
const RETIRED_SECTIONS: Readonly<Record<string, SettingsSectionId>> = {
  availability: "clinics",
  contact: "clinics",
};

/** Settings is its own page, not part of the agenda (user, 2026-09-30). */
export const SETTINGS_PATH = "/settings";

export function parseSettingsSection(
  raw: string | readonly string[] | null | undefined,
): SettingsSectionId {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const value = String(first ?? "").trim().toLowerCase();
  const match = SETTINGS_SECTIONS.find((section) => section.id === value);
  if (match) return match.id;
  if (Object.hasOwn(RETIRED_SECTIONS, value)) return RETIRED_SECTIONS[value];
  return DEFAULT_SETTINGS_SECTION;
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
