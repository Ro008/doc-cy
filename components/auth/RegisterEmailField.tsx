"use client";

import * as React from "react";
import { useRegisterContactTaken } from "@/components/auth/useRegisterContactTaken";
import { REGISTER_EMAIL_HTML_PATTERN, suggestRegisterEmail } from "@/lib/register-email";
import {
  registerFieldErrorClass,
  registerInputClass,
  registerLabelClass,
} from "@/lib/register-ui";

/**
 * Email with a "Did you mean …?" hint for common provider typos. The hint shows
 * once the user leaves the field (not while typing) and never blocks: a wrong
 * domain only costs them the confirmation email, so we point it out.
 */
export function RegisterEmailField({ lockedEmail = null }: { lockedEmail?: string | null } = {}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [suggestion, setSuggestion] = React.useState<string | null>(null);
  const [taken, clearTaken] = useRegisterContactTaken(inputRef, "email");

  const applySuggestion = () => {
    const input = inputRef.current;
    if (!input || !suggestion) return;
    // Uncontrolled input: set the DOM value and fire `input` so validation re-reads it.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      input,
      suggestion,
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    setSuggestion(null);
    input.focus();
  };

  return (
    <div
      className="group"
      data-validate-field="1"
      data-invalid="0"
      data-field-key="email"
      data-field-label="Email address"
    >
      <label className={registerLabelClass}>
        Email Address<span className="text-red-600">*</span>
        <input
          ref={inputRef}
          type="email"
          name="email"
          required
          // Signed in to apply again: the email is the account's login.
          readOnly={Boolean(lockedEmail)}
          defaultValue={lockedEmail ?? undefined}
          autoComplete="email"
          pattern={REGISTER_EMAIL_HTML_PATTERN}
          title="Use a valid email. '+' aliases are supported (e.g. rociosirvent+test@gmail.com)."
          onBlur={(event) => {
            if (!lockedEmail) setSuggestion(suggestRegisterEmail(event.currentTarget.value));
          }}
          onChange={() => {
            setSuggestion(null);
            clearTaken();
          }}
          className={registerInputClass}
        />
      </label>
      {lockedEmail ? (
        <p className="mt-1 text-xs text-ink-600" data-testid="register-email-locked">
          You&apos;re signed in, so this application uses this account.
        </p>
      ) : null}
      {taken ? (
        <p data-testid="register-email-taken" role="alert" className="mt-1 text-xs font-semibold text-red-700">
          {taken}
        </p>
      ) : null}
      {suggestion ? (
        <p
          data-testid="register-email-suggestion"
          className="mt-1 text-xs text-ink-700"
          role="status"
        >
          Did you mean{" "}
          <button
            type="button"
            onClick={applySuggestion}
            className="font-bold text-clinical-800 underline underline-offset-2 hover:text-clinical-900"
          >
            {suggestion}
          </button>
          ?
        </p>
      ) : null}
      <p className={registerFieldErrorClass}>Enter a valid email, e.g. name@practice.com.</p>
    </div>
  );
}
