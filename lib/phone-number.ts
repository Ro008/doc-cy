/** Shared by the manual booking modal and the server (lib/booking-patient-fields.ts). */

// A leading + (also written "(+357)"), then digits and the usual separators.
const PHONE_CHARS = /^\(?\+?[0-9\s\-().]+$/;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15; // E.164

/** Digits, spaces, dashes, dots and brackets, an optional leading + or (+, 7 to 15 digits. */
export function manualPhoneProblem(value: string): "required" | "invalid" | null {
  const t = value.trim();
  if (!t) return "required";
  if (!PHONE_CHARS.test(t)) return "invalid";
  const digits = t.replace(/\D/g, "").length;
  if (digits < MIN_PHONE_DIGITS || digits > MAX_PHONE_DIGITS) return "invalid";
  return null;
}
