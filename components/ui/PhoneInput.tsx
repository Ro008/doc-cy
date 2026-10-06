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
  label?: string;
  id?: string;
  /** When true, show validation error only after submit attempt (never on load). */
  showValidationError?: boolean;
  /** A message from the form (e.g. "phone required"); replaces the built-in one. */
  errorMessage?: string | null;
};

export function PhoneInput({
  value,
  onChange,
  defaultCountry = "cy",
  label,
  id,
  showValidationError = false,
  errorMessage = null,
}: PhoneInputProps) {
  const [isValid, setIsValid] = React.useState(true);
  const t = useTranslations("BookingPage");

  const handleChange: IntlPhoneInputProps["onChange"] = (phone, meta) => {
    // Lightweight validation based on length relative to country dial code
    const digits = phone.replace(/\D/g, "");
    const dialLen = meta.country.dialCode.length;
    const minLen = dialLen + 4; // min 4 national significant digits
    const maxLen = dialLen + 10; // max 10 national significant digits

    const valid = digits.length >= minLen && digits.length <= maxLen;

    setIsValid(valid);
    onChange(phone, valid);
  };

  // Red only once there is something to fix: the box starts as just "+357", which is not a
  // valid number yet but must not look like an error before the patient has done anything.
  const showError = Boolean(errorMessage) || (showValidationError && !isValid);

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-ink-800">
          {label}
        </label>
      )}
      <IntlPhoneInput
        defaultCountry={defaultCountry}
        value={value}
        onChange={handleChange}
        className="w-full"
        // The library paints its own border (country button and input); its variable turns both red.
        style={
          showError
            ? ({ "--react-international-phone-border-color": "#f87171" } as React.CSSProperties)
            : undefined
        }
        inputProps={
          id
            ? {
                id,
                "aria-invalid": errorMessage ? true : undefined,
                "aria-describedby": errorMessage ? `${id}-error` : undefined,
              }
            : undefined
        }
        inputClassName={`w-full rounded-md border px-3 py-2 text-sm text-ink-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-clinical-500 ${
          showError ? "border-red-500" : "border-ink-200"
        }`}
      />
      {errorMessage ? (
        <p id={id ? `${id}-error` : undefined} role="alert" className="text-xs font-medium text-red-600">
          {errorMessage}
        </p>
      ) : showValidationError && !isValid ? (
        <p className="text-xs text-red-600">
          {t("phoneValidationError")}
        </p>
      ) : null}
    </div>
  );
}

