"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordToggleInputProps = {
  name: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
};

export function PasswordToggleInput({
  name,
  required,
  minLength,
  placeholder,
  className,
  value,
  onChange,
}: PasswordToggleInputProps) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="relative mt-1">
      <input
        name={name}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className={`w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 ${
          className ?? ""
        }`}
        autoComplete={name === "password" ? "current-password" : undefined}
      />

      <button
        type="button"
        onClick={() => setShowPassword((v) => !v)}
        aria-label={showPassword ? "Hide" : "Show"}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
      >
        {showPassword ? (
          <EyeOff className="h-5 w-5" aria-hidden />
        ) : (
          <Eye className="h-5 w-5" aria-hidden />
        )}
      </button>
    </div>
  );
}

