import { publicPersonalMobile } from "@/lib/public/profile-personal-mobile";

export type ProfessionalRow = {
  id?: string | null;
  mobile_number?: string | null;
  is_registered?: boolean | null;
  is_archived?: boolean | null;
};

export type SettingsRow = { professional_id?: string | null; show_mobile_on_profile?: boolean | null };

/**
 * Who on the page shows a personal mobile ("Mobile Number" on her finder card; Finder G,
 * step 4): the same rule as her profile (`publicPersonalMobile`). Only the ids leave this
 * module; the number is sent by the reveal route after the click.
 */
export function finderPersonalMobileShownIds(
  professionals: readonly ProfessionalRow[],
  settings: readonly SettingsRow[],
): Set<string> {
  const settingsById = new Map(
    settings.map((row) => [String(row.professional_id ?? "").trim(), row] as const),
  );
  const out = new Set<string>();
  for (const row of professionals) {
    const id = String(row.id ?? "").trim();
    if (id && publicPersonalMobile(row, settingsById.get(id))) out.add(id);
  }
  return out;
}
