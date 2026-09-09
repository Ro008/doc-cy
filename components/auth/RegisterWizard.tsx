"use client";

import * as React from "react";
import {
  isRegisterFieldComplete,
  revealRegisterField,
} from "@/components/auth/useRegisterFieldStates";
import { RegisterFormProgress } from "@/components/auth/RegisterFormProgress";
import { RegisterSubmitButton } from "@/components/auth/RegisterFormSubmitFeedback";
import {
  RegisterWizardContext,
  useRegisterWizard,
} from "@/components/auth/register-wizard-context";
import { registerSecondaryButtonClass } from "@/lib/register-ui";

export const REGISTER_WIZARD_STEP_COUNT = 3;

export const REGISTER_NEXT_EVENT = "doccy-register-next";

export function RegisterWizard({
  formId,
  submitLabel,
  children,
}: {
  formId: string;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [step, setStep] = React.useState(1);
  const stepCount = REGISTER_WIZARD_STEP_COUNT;
  const stepRef = React.useRef(step);
  stepRef.current = step;

  React.useEffect(() => {
    const form = document.getElementById(formId);
    if (form instanceof HTMLFormElement) {
      form.dataset.wizardStep = String(step);
    }
  }, [formId, step]);

  const goNext = React.useCallback(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const current = stepRef.current;
    const event = new CustomEvent(REGISTER_NEXT_EVENT, {
      bubbles: true,
      cancelable: true,
      detail: { step: current },
    });
    form.dispatchEvent(event);
    if (event.defaultPrevented) return;
    setStep((value) => Math.min(stepCount, value + 1));
  }, [formId, stepCount]);

  React.useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const onSubmit = (event: Event) => {
      if (stepRef.current >= stepCount) return;
      event.preventDefault();
      goNext();
    };
    form.addEventListener("submit", onSubmit, true);
    return () => form.removeEventListener("submit", onSubmit, true);
  }, [formId, goNext, stepCount]);

  const goBack = () => {
    setStep((current) => Math.max(1, current - 1));
  };

  return (
    <RegisterWizardContext.Provider value={{ step, stepCount, setStep }}>
      <RegisterFormProgress formId={formId} />
      {children}
      <div className="flex flex-col gap-3 border-t border-ink-200/80 pt-5 sm:flex-row sm:items-center sm:justify-end">
        {step > 1 ? (
          <button type="button" onClick={goBack} className={registerSecondaryButtonClass}>
            Back
          </button>
        ) : null}
        {step < stepCount ? (
          <button
            type="button"
            onClick={goNext}
            data-testid="register-wizard-continue"
            className="inline-flex w-full items-center justify-center rounded-xl bg-clinical-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(18,184,192,0.2),0_4px_14px_rgba(18,184,192,0.22)] transition hover:bg-clinical-400 sm:w-auto"
          >
            Continue
          </button>
        ) : (
          <RegisterSubmitButton>{submitLabel}</RegisterSubmitButton>
        )}
      </div>
    </RegisterWizardContext.Provider>
  );
}

export function RegisterWizardStep({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const wizard = useRegisterWizard();
  const active = (wizard?.step ?? 1) === step;
  return (
    <section
      data-register-step={step}
      data-testid={`register-step-${step}`}
      hidden={!active}
      className="space-y-6"
    >
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-ink-900">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function missingFieldsInRegisterStep(
  form: HTMLFormElement,
  step: number,
): HTMLElement[] {
  const section = form.querySelector<HTMLElement>(`[data-register-step="${step}"]`);
  if (!section) return [];
  return Array.from(section.querySelectorAll<HTMLElement>("[data-validate-field='1']")).filter(
    (field) => !isRegisterFieldComplete(field),
  );
}

export function revealFirstMissingRegisterStepField(
  form: HTMLFormElement,
  step: number,
): string | null {
  const missing = missingFieldsInRegisterStep(form, step);
  const key = missing[0]?.dataset.fieldKey ?? null;
  if (key) revealRegisterField(form, key);
  return key;
}
