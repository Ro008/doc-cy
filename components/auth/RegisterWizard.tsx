"use client";

import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
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
import { registerPrimaryButtonClass } from "@/lib/register-ui";
import {
  registerAccountSummary,
  registerProfileSummary,
} from "@/lib/register-wizard-summary";

export const REGISTER_WIZARD_STEP_COUNT = 3;

export const REGISTER_NEXT_EVENT = "doccy-register-next";

const CONTINUE_LABELS: Record<number, string> = {
  1: "Continue to profile",
  2: "Continue to practice",
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Brings the newly opened step card into view — only if part of it is off-screen.
 * On desktop the whole wizard fits in one viewport, so this must not move the page.
 */
function scrollRegisterWizardToTop(step: number): void {
  const card = document.querySelector<HTMLElement>(`[data-register-step-card="${step}"]`);
  if (!card) return;
  card.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "nearest",
  });
}

function readStepSummary(form: HTMLFormElement, step: number): string {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? "");
  if (step === 1) {
    return registerAccountSummary({
      firstName: text("firstName"),
      lastName: text("lastName"),
      email: text("email"),
    });
  }
  if (step === 2) {
    const photo = form.querySelector<HTMLElement>("[data-field-key='photo']");
    return registerProfileSummary({
      photoReady: photo ? isRegisterFieldComplete(photo) : false,
      languages: data.getAll("language").map(String),
    });
  }
  return "";
}

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
  const [summaries, setSummaries] = React.useState<Record<number, string>>({});
  const stepCount = REGISTER_WIZARD_STEP_COUNT;
  const stepRef = React.useRef(step);
  stepRef.current = step;

  React.useEffect(() => {
    const form = document.getElementById(formId);
    if (form instanceof HTMLFormElement) {
      form.dataset.wizardStep = String(step);
    }
  }, [formId, step]);

  // Scroll only when the user changes step — never on first mount.
  // Comparing to the previous step (not a "first paint" flag) also survives
  // React Strict Mode's double effect invoke in development.
  const previousStepRef = React.useRef(step);
  React.useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    scrollRegisterWizardToTop(step);
    const heading = document.querySelector<HTMLElement>(
      `[data-register-step-card="${step}"] h3`,
    );
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [step]);

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
    const summary = readStepSummary(form, current);
    setSummaries((existing) => ({ ...existing, [current]: summary }));
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

  return (
    <RegisterWizardContext.Provider
      value={{ step, stepCount, setStep, goNext, submitLabel, summaries }}
    >
      <RegisterFormProgress formId={formId} />
      <div className="space-y-3 lg:space-y-2.5">{children}</div>
    </RegisterWizardContext.Provider>
  );
}

function stepCardClass(state: "active" | "done" | "pending"): string {
  if (state === "active") {
    return "border-2 border-clinical-500 bg-white shadow-[0_10px_32px_rgba(18,184,192,0.2)]";
  }
  if (state === "done") return "border border-wellness-100 bg-wellness-50";
  return "border border-ink-100 bg-ink-50";
}

function stepNumberClass(state: "active" | "done" | "pending"): string {
  if (state === "active") return "bg-clinical-500 text-ink-900";
  if (state === "done") return "bg-wellness-500 text-white";
  return "border-[1.5px] border-ink-200 bg-white text-ink-600";
}

/** Continue (steps 1–2) or submit (last step), rendered only inside the open step. */
function RegisterWizardStepActions() {
  const wizard = useRegisterWizard();
  if (!wizard) return null;
  if (wizard.step >= wizard.stepCount) {
    return <RegisterSubmitButton>{wizard.submitLabel}</RegisterSubmitButton>;
  }
  return (
    <button
      type="button"
      onClick={wizard.goNext}
      data-testid="register-wizard-continue"
      className={registerPrimaryButtonClass}
    >
      {CONTINUE_LABELS[wizard.step] ?? "Continue"}
      <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
    </button>
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
  const current = wizard?.step ?? 1;
  const active = current === step;
  const state = active ? "active" : step < current ? "done" : "pending";
  const summary = state === "done" ? wizard?.summaries[step] : "";

  return (
    <section
      data-register-step-card={step}
      aria-current={active ? "step" : undefined}
      className={`scroll-mt-6 rounded-[20px] px-4 transition sm:px-5 ${
        active ? "py-4 lg:py-3.5" : "py-2.5 lg:py-2"
      } ${stepCardClass(state)}`}
    >
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold ${stepNumberClass(state)}`}
        >
          {state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : step}
        </span>
        <div className="min-w-0 flex-1">
          {/* Finished steps keep their recap on the title line so collapsed cards stay short. */}
          <div className="flex min-w-0 items-baseline gap-2">
            <h3
              className={`shrink-0 text-base font-bold tracking-tight outline-none ${
                state === "pending" ? "text-ink-600" : "text-ink-900"
              }`}
            >
              {title}
              {state === "done" ? <span className="sr-only"> (completed)</span> : null}
            </h3>
            {summary ? (
              <p className="min-w-0 truncate text-[13px] text-ink-600">{summary}</p>
            ) : null}
          </div>
          {active ? (
            <p className="text-[13px] leading-snug text-ink-600">{description}</p>
          ) : null}
        </div>
        {state === "done" ? (
          <button
            type="button"
            onClick={() => wizard?.setStep(step)}
            className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-bold text-clinical-800 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500"
          >
            Edit<span className="sr-only"> {title}</span>
          </button>
        ) : null}
      </div>

      <div
        data-register-step={step}
        data-testid={`register-step-${step}`}
        hidden={!active}
        className={`mt-4 space-y-4 lg:mt-3 lg:space-y-3.5${active ? " register-step-in" : ""}`}
      >
        {children}
        {active ? <RegisterWizardStepActions /> : null}
      </div>
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
