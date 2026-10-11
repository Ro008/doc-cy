import { isValidPhoneNumber } from "libphonenumber-js/mobile";

/** Shared by the manual booking modal and the server (lib/booking-patient-fields.ts). */

// A leading + (also written "(+357)"), then digits and the usual separators.
const PHONE_CHARS = /^\(?\+?[0-9\s\-().]+$/;

/**
 * A real mobile number with its country code (leading + or 00; digits, spaces, dashes, dots and
 * brackets). The `mobile` metadata knows each country's mobile prefixes and lengths, so
 * landlines and wrong prefixes are refused.
 */
export function manualPhoneProblem(value: string): "required" | "invalid" | null {
  const t = value.trim();
  if (!t) return "required";
  if (!PHONE_CHARS.test(t)) return "invalid";
  const digits = t.replace(/\D/g, "");
  const hasPlus = /^\(?\+/.test(t);
  if (!hasPlus && !digits.startsWith("00")) return "invalid";
  const e164 = hasPlus ? `+${digits}` : `+${digits.slice(2)}`;
  return isValidPhoneNumber(e164) ? null : "invalid";
}

/**
 * The online booking form's rule (2026-10-10): a real mobile, like manual booking. The form
 * always sends the country code; a number typed without one (API callers, older clients) is
 * read as Cypriot. Only checks: the value is stored as sent.
 */
export function onlineBookingPhoneProblem(value: string): "required" | "invalid" | null {
  const t = value.trim();
  if (!t) return "required";
  const hasCountry = /^\(?\+/.test(t) || t.replace(/\D/g, "").startsWith("00");
  return manualPhoneProblem(hasCountry ? t : `+357 ${t}`);
}
