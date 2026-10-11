import { getExampleNumber, type CountryCode } from "libphonenumber-js/mobile";
import examples from "libphonenumber-js/mobile/examples";

/**
 * Pieces of the public booking form (user, 2026-10-10), following the healthcare and GOV.UK
 * patterns: first and last name in two boxes (the clinic needs the surname to find the record;
 * nothing else is checked), the birth date as Day / Month / Year, and an example mobile number.
 */

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

/** The database keeps one `patient_name`: "First Last". */
export function fullPatientName(first: string, last: string): string {
  return [clean(first), clean(last)].filter(Boolean).join(" ");
}

/**
 * YYYY-MM-DD from the three boxes, or "" while one is empty or not a number (a 4-digit year).
 * Impossible dates (31 February) are built as typed; the form's check refuses them.
 */
export function birthdateFromParts(parts: { day: string; month: string; year: string }): string {
  const day = parts.day.trim();
  const month = parts.month.trim();
  const year = parts.year.trim();
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** An example mobile for the country, as typed after its dial code ("96 123456" for Cyprus). */
export function mobilePlaceholder(iso2: string): string {
  try {
    const example = getExampleNumber(iso2.toUpperCase() as CountryCode, examples);
    return example ? example.formatInternational().replace(/^\+\d+\s*/, "") : "";
  } catch {
    return "";
  }
}
