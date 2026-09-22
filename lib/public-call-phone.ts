import { cyprusPhoneDigits } from "@/lib/phone-link";

export const PUBLIC_PHONE_SOURCES = ["mobile", "directory"] as const;
export type PublicPhoneSource = (typeof PUBLIC_PHONE_SOURCES)[number];

export function parsePublicPhoneSource(value: unknown): PublicPhoneSource {
  return value === "mobile" ? "mobile" : "directory";
}

export function phonesMatch(a?: string | null, b?: string | null): boolean {
  const left = String(a ?? "").trim();
  const right = String(b ?? "").trim();
  if (!left || !right) return false;
  const leftDigits = cyprusPhoneDigits(left);
  const rightDigits = cyprusPhoneDigits(right);
  if (leftDigits && rightDigits) return leftDigits === rightDigits;
  return left === right;
}

export function hasDistinctDirectoryPhone(
  mobileNumber?: string | null,
  directoryPhone?: string | null,
): boolean {
  const directory = String(directoryPhone ?? "").trim();
  if (!directory) return false;
  return !phonesMatch(mobileNumber, directory);
}

export function callNumberForSource(input: {
  source: PublicPhoneSource;
  mobileNumber?: string | null;
  directoryPhone?: string | null;
}): string {
  if (input.source === "mobile") return String(input.mobileNumber ?? "").trim();
  return String(input.directoryPhone ?? "").trim();
}

/** Which number the Call button should use when both exist. */
export function inferPublicPhoneSource(input: {
  saved?: unknown;
  mobileNumber?: string | null;
  directoryPhone?: string | null;
}): PublicPhoneSource {
  const mobile = String(input.mobileNumber ?? "").trim();
  const directory = String(input.directoryPhone ?? "").trim();
  const saved = parsePublicPhoneSource(input.saved);
  if (hasDistinctDirectoryPhone(mobile, directory)) {
    if (saved === "mobile" && mobile) return "mobile";
    if (directory) return "directory";
    return "mobile";
  }
  if (directory && !mobile) return "directory";
  return "mobile";
}

export function directoryPhoneForSave(input: {
  clinicRowVisible: boolean;
  clinicPhone: string;
  mobileNumber: string;
  initialDirectoryPhone: string;
  initialMobileNumber: string;
}): string | null {
  if (input.clinicRowVisible) {
    return input.clinicPhone.trim() || null;
  }
  if (
    input.initialDirectoryPhone.trim() &&
    phonesMatch(input.initialDirectoryPhone, input.initialMobileNumber)
  ) {
    return input.mobileNumber.trim() || null;
  }
  return null;
}

export function publicPhoneSourceForSave(input: {
  showPhonePublic: boolean;
  selected: PublicPhoneSource;
  mobileNumber: string;
  directoryPhone: string | null;
}): PublicPhoneSource {
  const mobile = input.mobileNumber.trim();
  const directory = String(input.directoryPhone ?? "").trim();
  const distinct = hasDistinctDirectoryPhone(mobile, directory);
  if (distinct) return input.selected;
  if (directory && !mobile) return "directory";
  return "mobile";
}

/**
 * The phone number a public reader may see for a registered professional.
 *
 * This is the rule the `doctors_public` / `professionals_public` views used to apply
 * in SQL, moved into code when those views were dropped:
 *   hidden unless professional_settings.show_phone_public, then the mobile or the directory
 *   number depending on professional_settings.public_phone_source (default "directory"),
 *   blank-as-null.
 */
export function publicPhoneForProfessional(input: {
  showPhonePublic?: boolean | null;
  publicPhoneSource?: unknown;
  phone?: string | null;
  mobileNumber?: string | null;
  /** pause_online_bookings of each clinic. One paused clinic reveals the phone. */
  pauseFlags?: readonly boolean[];
}): string | null {
  // A clinic that takes no online bookings leaves its patients the phone as their only
  // way in, so the number shows whatever the Call button says. Derived on read rather
  // than stored, so it is true for professionals who never opened their settings — and
  // so resuming bookings restores whatever they had chosen.
  const revealedByPause = (input.pauseFlags ?? []).some(Boolean);
  if (!input.showPhonePublic && !revealedByPause) return null;
  const source = input.showPhonePublic
    ? parsePublicPhoneSource(input.publicPhoneSource)
    : // Nothing was ever chosen here, so fall back to whichever number exists.
      inferPublicPhoneSource({
        saved: input.publicPhoneSource,
        mobileNumber: input.mobileNumber,
        directoryPhone: input.phone,
      });
  const number = callNumberForSource({
    source,
    mobileNumber: input.mobileNumber,
    directoryPhone: input.phone,
  });
  return number.trim() || null;
}
