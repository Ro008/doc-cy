"use client";

import * as React from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

type PasswordToggleInputProps = {
  name: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  title?: string;
  placeholder?: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  tone?: "dark" | "light";
  autoComplete?: string;
  /** Shows a copy button (useful on register / new-password fields). */
  allowCopy?: boolean;
};

export function PasswordToggleInput({
  name,
  required,
  minLength,
  maxLength,
  pattern,
  title,
  placeholder,
  className,
  value,
  onChange,
  tone = "dark",
  autoComplete,
  allowCopy = false,
}: PasswordToggleInputProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [uncontrolledHasText, setUncontrolledHasText] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const copiedTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (copiedTimerRef.current != null) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const inputClass =
    tone === "light"
      ? "w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-clinical-400 focus:ring-2 focus:ring-clinical-400/25"
      : "w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-clinical-400 focus:ring-2 focus:ring-clinical-400/40";

  const toggleClass =
    tone === "light"
      ? "rounded-md p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 focus:outline-none focus:ring-2 focus:ring-clinical-400/60 disabled:cursor-not-allowed disabled:opacity-40"
      : "rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-clinical-400/60 disabled:cursor-not-allowed disabled:opacity-40";

  const isControlled = value !== undefined;
  const canCopy = allowCopy && (isControlled ? value.length > 0 : uncontrolledHasText);

  async function copyPassword() {
    const text =
      (isControlled ? value : inputRef.current?.value)?.toString() ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers / insecure contexts.
      const input = inputRef.current;
      if (!input) return;
      const wasType = input.type;
      input.type = "text";
      input.focus();
      input.select();
      try {
        document.execCommand("copy");
      } finally {
        input.type = wasType;
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
    setCopied(true);
    if (copiedTimerRef.current != null) window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative mt-1">
      <input
        ref={inputRef}
        name={name}
        type={showPassword ? "text" : "password"}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        pattern={pattern}
        title={title}
        className={`${inputClass} ${allowCopy ? "pr-20" : "pr-11"} ${className ?? ""}`}
        autoComplete={
          autoComplete ?? (name === "password" ? "current-password" : undefined)
        }
        {...(isControlled
          ? {
              value,
              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                onChange?.(event.target.value),
            }
          : {
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                setUncontrolledHasText(event.target.value.length > 0);
              },
            })}
      />

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {allowCopy ? (
          <button
            type="button"
            onClick={() => void copyPassword()}
            disabled={!canCopy}
            aria-label={copied ? "Copied" : "Copy password"}
            title={copied ? "Copied" : "Copy password"}
            data-testid="password-copy-button"
            className={toggleClass}
          >
            {copied ? (
              <Check className="h-4 w-4 text-clinical-600" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className={toggleClass}
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5" aria-hidden />
          ) : (
            <Eye className="h-5 w-5" aria-hidden />
          )}
        </button>
      </div>
      {allowCopy && copied ? (
        <p className="sr-only" role="status" aria-live="polite">
          Password copied to clipboard
        </p>
      ) : null}
    </div>
  );
}
