// components/ui/PhoneInput.tsx
"use client";

import * as React from "react";
import {
  PhoneInput as IntlPhoneInput,
  PhoneInputProps as IntlPhoneInputProps,
} from "react-international-phone";
import "react-international-phone/style.css";

export type PhoneInputProps = {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  defaultCountry?: string; // e.g. "cy"
  label?: string;
  id?: string;
  /** When true, show validation error only after submit attempt (never on load). */
  showValidationError?: boolean;
};

export function PhoneInput({
  value,
  onChange,
  defaultCountry = "cy",
  label,
  id,
  showValidationError = false,
}: PhoneInputProps) {
  const [isValid, setIsValid] = React.useState(true);

  const handleChange: IntlPhoneInputProps["onChange"] = (phone, meta) => {
    // Lightweight validation based on length relative to country dial code
    const digits = phone.replace(/\D/g, "");
    const dialLen = meta.country.dialCode.length;
    const minLen = dialLen + 4; // 4 dígitos locales mínimo
    const maxLen = dialLen + 10; // 10 dígitos locales máximo

    const valid = digits.length >= minLen && digits.length <= maxLen;

    setIsValid(valid);
    onChange(phone, valid);
  };

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-slate-700">
          {label}
        </label>
      )}
      <IntlPhoneInput
        defaultCountry={defaultCountry}
        value={value}
        onChange={handleChange}
        className="w-full"
        inputProps={id ? { id } : undefined}
        inputClassName={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${
          !isValid ? "border-red-500" : "border-slate-200"
        }`}
      />
      {showValidationError && !isValid && (
        <p className="text-xs text-red-600">
          Please double‑check the phone number length for the selected country.
        </p>
      )}
    </div>
  );
}

