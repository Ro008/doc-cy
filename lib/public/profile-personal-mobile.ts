import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * The professional's personal mobile on her public profile (user, 2026-10-13). The
 * clinic's phone stays the main public phone; the mobile is an extra she switches on in
 * Settings › Account ("Show on my profile", off by default). It shows in the hero behind
 * a "Show mobile" button and is fetched on the click, so it is never in the page's HTML.
 */

type ProfessionalRow = {
  mobile_number?: string | null;
  is_registered?: boolean | null;
  is_archived?: boolean | null;
};

type SettingsRow = { show_mobile_on_profile?: boolean | null };

/** Her mobile as stored, or null when patients must not see it. */
export function publicPersonalMobile(
  professional: ProfessionalRow | null | undefined,
  settings: SettingsRow | null | undefined,
): string | null {
  if (!professional || professional.is_registered !== true || professional.is_archived === true) {
    return null;
  }
  if (settings?.show_mobile_on_profile !== true) return null;
  const mobile = String(professional.mobile_number ?? "").trim();
  return mobile || null;
}

/** "+357 99 123456": grouped as its country writes it; as stored when it cannot be read. */
export function personalMobileDisplay(mobile: string): string {
  const raw = mobile.trim();
  return parsePhoneNumberFromString(raw)?.formatInternational() ?? raw;
}

export function personalMobileTelHref(mobile: string): string | null {
  const parsed = parsePhoneNumberFromString(mobile.trim());
  return parsed ? `tel:${parsed.number}` : null;
}
