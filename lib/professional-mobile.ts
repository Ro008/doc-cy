import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js/mobile";

/**
 * The professional's personal mobile (`professionals.mobile_number`), checked the same
 * way on the server for /register and Settings → Profile: a real mobile for its
 * country (the `mobile` metadata refuses landlines and wrong prefixes), written with
 * its "+" country code, stored as "+" and digits. The forms compose that value from
 * the country picker (lib/register-phone.ts); this is the server's last word.
 */

// "+" then digits and the usual separators.
const MOBILE_CHARS = /^\+[0-9\s\-().]+$/;

export type ProfessionalMobileResult =
  | { ok: true; e164: string }
  | { ok: false; problem: "required" | "invalid" };

export function normalizeProfessionalMobile(value: unknown): ProfessionalMobileResult {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { ok: false, problem: "required" };
  if (!MOBILE_CHARS.test(text) || !isValidPhoneNumber(text)) return { ok: false, problem: "invalid" };
  const parsed = parsePhoneNumberFromString(text);
  if (!parsed) return { ok: false, problem: "invalid" };
  return { ok: true, e164: parsed.number };
}

export const PROFESSIONAL_MOBILE_INVALID_MESSAGE =
  "Enter a valid mobile number with its country code, e.g. +357 99 123456.";
