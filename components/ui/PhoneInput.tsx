// components/ui/PhoneInput.tsx
"use client";

import * as React from "react";
import {
  PhoneInput as IntlPhoneInput,
  PhoneInputProps as IntlPhoneInputProps,
} from "react-international-phone";
import "react-international-phone/style.css";
import { useTranslations } from "next-intl";

export type PhoneInputProps = {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  defaultCountry?: string; // e.g. "cy"
  label?: React.ReactNode;
  id?: string;
  /** When true, show validation error only after submit attempt (never on load). */
  showValidationError?: boolean;
  /** A message from the form (e.g. "phone required"); replaces the built-in one. */
  errorMessage?: string | null;
  /**
   * "dark" for the professional's dark modals (manual booking); "profile" for the public
   * profile theme (light/dark + the doctor's accent, set as CSS variables in globals.css).
   */
  tone?: "light" | "dark" | "profile";
};

/** Digits allowed after the country code (same rule as the validity check below). */
const MIN_NATIONAL_DIGITS = 4;
const MAX_NATIONAL_DIGITS = 10;

/** The library's own CSS variables, for the dark modals. */
const DARK_VARS = {
  "--react-international-phone-background-color": "rgba(6, 28, 58, 0.4)",
  "--react-international-phone-text-color": "#f1f5f9",
  "--react-international-phone-border-color": "rgba(30, 41, 59, 0.8)",
  "--react-international-phone-country-selector-background-color": "rgba(6, 28, 58, 0.4)",
  "--react-international-phone-country-selector-background-color-hover": "rgba(30, 41, 59, 0.9)",
  "--react-international-phone-country-selector-arrow-color": "#94a3b8",
  "--react-international-phone-dropdown-item-background-color": "#0f172a",
  "--react-international-phone-dropdown-item-text-color": "#e2e8f0",
  "--react-international-phone-dropdown-item-dial-code-color": "#94a3b8",
  "--react-international-phone-selected-dropdown-item-background-color": "#1e293b",
  "--react-international-phone-selected-dropdown-item-text-color": "#f8fafc",
  "--react-international-phone-dropdown-preferred-list-divider-color": "#334155",
  "--react-international-phone-height": "38px",
  "--react-international-phone-border-radius": "16px",
} as React.CSSProperties;

export function PhoneInput({
  value,
  onChange,
  defaultCountry = "cy",
  label,
  id,
  showValidationError = false,
  errorMessage = null,
  tone = "light",
}: PhoneInputProps) {
  const [isValid, setIsValid] = React.useState(true);
  /** Dial code length of the selected country (Cyprus "357" until the patient changes it). */
  const dialLenRef = React.useRef(3);

  const handleChange: IntlPhoneInputProps["onChange"] = (phone, meta) => {
    // Lightweight validation based on length relative to country dial code
    const digits = phone.replace(/\D/g, "");
    const dialLen = meta.country.dialCode.length;
    dialLenRef.current = dialLen;
    const minLen = dialLen + MIN_NATIONAL_DIGITS;
    const maxLen = dialLen + MAX_NATIONAL_DIGITS;

    const valid = digits.length >= minLen && digits.length <= maxLen;

    setIsValid(valid);
    onChange(phone, valid);
  };

  /** No more digits once the number is as long as a phone number can be for that country. */
  function blockExtraDigits(event: React.FormEvent<HTMLInputElement>) {
    const data = (event.nativeEvent as InputEvent).data ?? "";
    // One typed digit at a time. Pasted text (a full "+357 99 123456" over the "+357" already in
    // the box) goes through: the library re-parses it and the form checks it on save.
    if (!/^\d$/.test(data)) return;
    const input = event.currentTarget;
    if (input.selectionStart !== input.selectionEnd) return; // replacing a selection
    if (value.replace(/\D/g, "").length + 1 > dialLenRef.current + MAX_NATIONAL_DIGITS) {
      event.preventDefault();
    }
  }

  // Red only once there is something to fix: the box starts as just "+357", which is not a
  // valid number yet but must not look like an error before the patient has done anything.
  const showError = Boolean(errorMessage) || (showValidationError && !isValid);

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={id}
          className={
            tone === "profile"
              ? "text-sm font-semibold text-profile-text"
              : "text-xs font-semibold text-ink-800"
          }
        >
          {label}
        </label>
      )}
      <IntlPhoneInput
        defaultCountry={defaultCountry}
        value={value}
        onChange={handleChange}
        className="w-full"
        // The library paints its own border (country button and input); its variable turns both red.
        style={{
          ...(tone === "dark" ? DARK_VARS : {}),
          ...(showError ? ({ "--react-international-phone-border-color": "#f87171" } as React.CSSProperties) : {}),
        }}
        inputProps={
          id
            ? {
                id,
                "aria-invalid": errorMessage ? true : undefined,
                "aria-describedby": errorMessage ? `${id}-error` : undefined,
                onBeforeInput: blockExtraDigits,
              }
            : { onBeforeInput: blockExtraDigits }
        }
        inputClassName={
          tone === "profile"
            ? `w-full rounded-r-2xl border bg-profile-bg px-3 py-2.5 text-base text-profile-text focus:outline-none focus:ring-2 focus:ring-accent ${
                showError ? "border-red-500" : "border-profile-border"
              }`
            : `w-full rounded-md border px-3 py-2 text-sm text-ink-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-clinical-500 ${
                showError ? "border-red-500" : "border-ink-200"
              }`
        }
      />
      {errorMessage ? (
        <p
          id={id ? `${id}-error` : undefined}
          role="alert"
          className={`font-medium ${
            tone === "dark"
              ? "text-xs text-red-300"
              : tone === "profile"
                ? "text-sm text-red-600 [.doccy-profile[data-scheme=dark]_&]:text-red-400"
                : "text-xs text-red-600"
          }`}
        >
          {errorMessage}
        </p>
      ) : showValidationError && !isValid ? (
        <BuiltInPhoneError />
      ) : null}
    </div>
  );
}

/** Only the public booking form uses this message; pages without its translations never render it. */
function BuiltInPhoneError() {
  const t = useTranslations("BookingPage");
  return <p className="text-xs text-red-600">{t("phoneValidationError")}</p>;
}
