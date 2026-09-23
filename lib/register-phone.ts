import {
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/mobile";
import examples from "libphonenumber-js/mobile/examples";

/**
 * Mobile number helpers for /register. The `mobile` metadata only accepts numbers
 * that are real mobiles for their country: +34 667 000 000 passes, +34 123 456 789
 * (right length, wrong prefix) and Cyprus landlines (22…) do not.
 */

/** Shown first in the country-code dropdown: Cyprus, then the usual patient/staff mix. */
export const REGISTER_PHONE_PREFERRED_COUNTRIES = ["cy", "gr", "gb", "ru", "il", "ua", "de"] as const;

export const REGISTER_PHONE_DEFAULT_COUNTRY = "cy";

export type RegisterPhoneCountry = {
  /** ISO 3166-1 alpha-2, upper case ("CY"). */
  code: string;
  name: string;
  dialCode: string;
};

function toCountryCode(country: string): CountryCode | null {
  const code = country.trim().toUpperCase();
  return (getCountries() as string[]).includes(code) ? (code as CountryCode) : null;
}

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export function registerPhoneCountryName(country: string): string {
  const code = country.trim().toUpperCase();
  return regionNames?.of(code) ?? code;
}

/** Preferred countries first, then everything else alphabetically by name. */
export function registerPhoneCountries(): RegisterPhoneCountry[] {
  const all: RegisterPhoneCountry[] = (getCountries() as CountryCode[]).map((code) => ({
    code,
    name: registerPhoneCountryName(code),
    dialCode: `+${getCountryCallingCode(code)}`,
  }));
  const preferred = REGISTER_PHONE_PREFERRED_COUNTRIES.map((code) =>
    all.find((country) => country.code === code.toUpperCase()),
  ).filter((country): country is RegisterPhoneCountry => Boolean(country));
  const preferredCodes = new Set(preferred.map((country) => country.code));
  const rest = all
    .filter((country) => !preferredCodes.has(country.code))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...preferred, ...rest];
}

export function isValidRegisterMobile(e164: string): boolean {
  const value = e164.trim();
  if (!value.startsWith("+")) return false;
  return isValidPhoneNumber(value);
}

/** "+34 612 34 56 78" for Spain; null for an unknown country. */
export function registerMobileExample(country: string): string | null {
  const code = toCountryCode(country);
  if (!code) return null;
  return getExampleNumber(code, examples)?.formatInternational() ?? null;
}

/**
 * Turns what the user typed into E.164 for the chosen country. A number typed
 * with its own "+" prefix wins and reports its country, so pasting
 * "+34 667 000 000" while Cyprus is selected switches to Spain.
 */
export function composeRegisterPhone(
  country: string,
  typed: string,
): { e164: string; country: string } {
  const text = typed.trim();
  const code = toCountryCode(country) ?? "CY";
  if (text.startsWith("+")) {
    const parsed = parsePhoneNumberFromString(text);
    const digits = text.replace(/\D/g, "");
    return {
      e164: parsed?.number ?? (digits ? `+${digits}` : ""),
      country: parsed?.country ?? code,
    };
  }
  const digits = text.replace(/\D/g, "");
  if (!digits) return { e164: "", country: code };
  const parsed = parsePhoneNumberFromString(digits, code);
  return {
    e164: parsed?.number ?? `+${getCountryCallingCode(code)}${digits}`,
    country: code,
  };
}
