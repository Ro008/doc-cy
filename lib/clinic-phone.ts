import { parsePhoneNumberFromString } from "libphonenumber-js/mobile";

/**
 * Clinic phone numbers (`clinics.phone`): the number the public Call button shows.
 * A clinic proposed at registration must have one. Cyprus landlines (22–26) and
 * mobiles (94–97, 99) are accepted, stored as the 8 national digits every clinic
 * phone already uses ("25123456"). Same library as the professional's mobile
 * (`lib/register-phone.ts`); the prefix rule is ours, so toll-free and premium
 * numbers are refused.
 */

const CYPRUS_CLINIC_LINE = /^(?:2[2-6]|9[4-79])\d{6}$/;

/** "+357 25 123456" → "25123456"; null for anything else. No imports on the client beyond the form's. */
export function normalizeCyprusClinicPhone(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, "CY");
  if (!parsed || parsed.countryCallingCode !== "357") return null;
  const national = String(parsed.nationalNumber);
  return CYPRUS_CLINIC_LINE.test(national) ? national : null;
}

/** Shown under the field. */
export const CLINIC_PHONE_HINT = "A Cyprus landline or mobile, e.g. 25 123456 or 99 123456.";

/**
 * What the clinic phone field shows while she types (Settings → Clinics): the 8 national
 * digits grouped the Cypriot way, "25 123456". A pasted country code is dropped; "+357"
 * sits in front of the field.
 */
export function formatCyprusClinicPhoneInput(typed: string): string {
  let digits = String(typed ?? "").replace(/\D/g, "");
  if (digits.startsWith("00357")) digits = digits.slice(5);
  else if (digits.startsWith("357") && digits.length > 8) digits = digits.slice(3);
  digits = digits.slice(0, 8);
  return digits.length > 2 ? `${digits.slice(0, 2)} ${digits.slice(2)}` : digits;
}
