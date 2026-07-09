"use client";

import * as React from "react";
import { registerSubmitClass } from "@/lib/register-ui";

const RegisterSubmitContext = React.createContext(false);

type RegisterFormSubmitFeedbackProps = {
  formId: string;
  children: React.ReactNode;
  /** Server returned an error — release the submitting UI after redirect. */
  clearSubmitting?: boolean;
};

export function RegisterFormSubmitFeedback({
  formId,
  children,
  clearSubmitting = false,
}: RegisterFormSubmitFeedbackProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (clearSubmitting) {
      setIsSubmitting(false);
    }
  }, [clearSubmitting]);

  React.useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const onSubmit = () => {
      if (form.checkValidity()) {
        setIsSubmitting(true);
      }
    };

    const onInvalid = () => {
      setIsSubmitting(false);
    };

    const onPageShow = () => {
      setIsSubmitting(false);
    };

    form.addEventListener("submit", onSubmit);
    form.addEventListener("invalid", onInvalid, true);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("invalid", onInvalid, true);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [formId]);

  return (
    <RegisterSubmitContext.Provider value={isSubmitting}>
      <div className="relative">
        <fieldset
          aria-busy={isSubmitting}
          className={`min-w-0 border-0 p-0 m-0 ${
            isSubmitting ? "pointer-events-none" : ""
          }`}
        >
          {children}
        </fieldset>
        <div
          aria-hidden={!isSubmitting}
          className={`fixed inset-0 z-50 flex items-center justify-center bg-white/55 backdrop-blur-[3px] transition-opacity duration-200 ${
            isSubmitting ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div
            role="status"
            aria-live="polite"
            className="mx-4 flex max-w-md items-center gap-3 rounded-2xl border border-clinical-200 bg-white px-5 py-4 shadow-[0_12px_40px_rgba(26,43,60,0.12)]"
          >
            <span
              aria-hidden
              className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-clinical-400 border-r-transparent"
            />
            <div>
              <p className="text-sm font-semibold text-ink-900">Submitting your application…</p>
              <p className="mt-0.5 text-xs text-ink-600">
                Please keep this tab open while we upload your details.
              </p>
            </div>
          </div>
        </div>
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
      disabled={isSubmitting}
      aria-busy={isSubmitting}
      className={`${registerSubmitClass} gap-2 disabled:cursor-wait disabled:opacity-80`}
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
