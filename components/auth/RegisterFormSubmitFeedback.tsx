"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { RegisterSubmitWait } from "@/components/auth/RegisterSubmitWait";
import { registerSubmitClass } from "@/lib/register-ui";

const RegisterSubmitContext = React.createContext(false);

/** Backup if the Server Action never returns (network stall). */
const SUBMIT_WATCHDOG_MS = 90_000;

type RegisterFormSubmitFeedbackProps = {
  formId: string;
  children: React.ReactNode;
  /** Server returned an error — release the submitting UI after redirect. */
  clearSubmitting?: boolean;
};

export function RegisterFormSubmitFeedback({
  children,
  clearSubmitting = false,
}: RegisterFormSubmitFeedbackProps) {
  const { pending } = useFormStatus();
  const [timedOut, setTimedOut] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (clearSubmitting || !pending) {
      setTimedOut(false);
      setDismissed(false);
      return;
    }
    const timer = window.setTimeout(() => setTimedOut(true), SUBMIT_WATCHDOG_MS);
    return () => window.clearTimeout(timer);
  }, [pending, clearSubmitting]);

  const isSubmitting = pending && !dismissed;
  const showTimeout = isSubmitting && timedOut;

  return (
    <RegisterSubmitContext.Provider value={isSubmitting && !showTimeout}>
      <div className="relative">
        <fieldset
          aria-busy={isSubmitting}
          className={`min-w-0 border-0 p-0 m-0 ${
            isSubmitting ? "pointer-events-none" : ""
          }`}
        >
          {children}
        </fieldset>
        {isSubmitting ? (
        <div
          aria-hidden={false}
          data-testid="register-submit-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-50/80 backdrop-blur-md pointer-events-auto"
        >
          <div
            role="status"
            aria-live="polite"
            className="mx-4 rounded-3xl border border-clinical-200/90 bg-white px-6 py-7 shadow-[0_18px_50px_-18px_rgba(18,184,192,0.35),0_12px_40px_rgba(26,43,60,0.1)]"
          >
            <RegisterSubmitWait timedOut={showTimeout} />
            {showTimeout ? (
              <button
                type="button"
                className="mt-4 text-xs font-semibold text-clinical-700 underline underline-offset-2"
                onClick={() => setDismissed(true)}
              >
                Hide this message
              </button>
            ) : null}
          </div>
        </div>
        ) : null}
      </div>
    </RegisterSubmitContext.Provider>
  );
}

type RegisterSubmitButtonProps = {
  children: React.ReactNode;
};

export function RegisterSubmitButton({ children }: RegisterSubmitButtonProps) {
  const isSubmitting = React.useContext(RegisterSubmitContext);

  return (
    <button
      type="submit"
      aria-busy={isSubmitting}
      className={`${registerSubmitClass} gap-2 ${isSubmitting ? "cursor-wait opacity-80" : ""}`}
    >
      {isSubmitting ? (
        <>
          <span
            aria-hidden
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-r-transparent"
          />
          <span>Submitting your application…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
