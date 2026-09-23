"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import {
  REGISTER_PHONE_DEFAULT_COUNTRY,
  composeRegisterPhone,
  isValidRegisterMobile,
  registerMobileExample,
  registerPhoneCountries,
  type RegisterPhoneCountry,
} from "@/lib/register-phone";
import { registerFieldErrorClass, registerLabelClass } from "@/lib/register-ui";

const REGISTER_PHONE_DEFAULT_OPTION: RegisterPhoneCountry = {
  code: "CY",
  name: "Cyprus",
  dialCode: "+357",
};

/**
 * Mobile number with a country-code dropdown. Posts `phone` in E.164
 * (+34667000000) and only counts as complete when it is a real mobile for the
 * chosen country, via the hidden validity proxy the wizard already reads.
 */
export function RegisterPhoneField() {
  // Country names come from the runtime's Intl data, which differs between Node
  // and browsers ("Falkland Islands" vs "… (Islas Malvinas)"). Rendering the full
  // list on the server caused a hydration mismatch that re-rendered the form and
  // wiped typed values, so SSR and the first paint show only the default country.
  const [countries, setCountries] = React.useState<RegisterPhoneCountry[]>(() => [
    REGISTER_PHONE_DEFAULT_OPTION,
  ]);
  React.useEffect(() => {
    setCountries(registerPhoneCountries());
  }, []);
  const [country, setCountry] = React.useState(REGISTER_PHONE_DEFAULT_COUNTRY.toUpperCase());
  const [typed, setTyped] = React.useState("");

  const { e164 } = composeRegisterPhone(country, typed);
  const valid = isValidRegisterMobile(e164);
  const selected = countries.find((item) => item.code === country);
  const dialCode = selected?.dialCode ?? "";
  const example = registerMobileExample(country);
  const placeholder = example ? example.replace(`${dialCode} `, "") : "";

  const onNumberChange = (value: string) => {
    // A full international number (typed or pasted) picks its own country.
    if (value.trim().startsWith("+")) {
      const next = composeRegisterPhone(country, value);
      const nextDial = countries.find((item) => item.code === next.country)?.dialCode;
      if (nextDial && next.e164.startsWith(nextDial) && next.e164.length > nextDial.length) {
        setCountry(next.country);
        setTyped(next.e164.slice(nextDial.length));
        return;
      }
    }
    setTyped(value);
  };

  return (
    <div
      className="group"
      data-validate-field="1"
      data-invalid="0"
      data-field-key="phone"
      data-field-label="Mobile number"
    >
      <label htmlFor="register-phone" className={registerLabelClass}>
        Mobile Number<span className="text-red-600">*</span>
      </label>
      <div className="mt-1 flex rounded-[10px] border-[1.5px] border-ink-200 bg-white transition focus-within:border-clinical-500 focus-within:ring-4 focus-within:ring-clinical-500/20 group-data-[invalid=1]:border-red-300">
        {/* Native select for keyboard/screen readers; the visible face stays compact. */}
        <div className="relative flex shrink-0 items-center gap-1 border-r border-ink-100 pl-3 pr-2 text-sm font-semibold text-ink-800">
          <span aria-hidden>
            <span className="text-ink-500">{country}</span> {dialCode}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-ink-400" aria-hidden />
          <select
            aria-label="Country code"
            data-testid="register-phone-country"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {countries.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name} ({item.dialCode})
              </option>
            ))}
          </select>
        </div>
        <input
          id="register-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          data-testid="register-phone-input"
          data-focus-target="true"
          value={typed}
          onChange={(event) => onNumberChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-r-[10px] bg-transparent px-3 py-2.5 text-base text-ink-900 outline-none placeholder:text-ink-400 sm:text-[15px]"
        />
      </div>
      <input type="hidden" name="phone" value={valid ? e164 : ""} readOnly />
      <input
        type="text"
        data-validity-proxy="true"
        required
        value={valid ? "ok" : ""}
        // A readonly input is barred from constraint validation, which would make
        // this required field silently always valid. The no-op keeps React quiet.
        onChange={() => {}}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      <p className={registerFieldErrorClass}>
        Enter a valid {selected?.name ?? country} mobile number
        {example ? `, e.g. ${example}` : ""}.
      </p>
    </div>
  );
}
