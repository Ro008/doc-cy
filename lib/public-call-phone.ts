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
