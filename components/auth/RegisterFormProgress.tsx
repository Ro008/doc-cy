"use client";

import { useRegisterWizard } from "@/components/auth/register-wizard-context";

const STEP_LABELS = ["Account", "Profile", "Practice"] as const;

/** Slim status line above the accordion cards; the cards themselves show each step's state. */
export function RegisterFormProgress({ formId: _formId }: { formId: string }) {
  const wizard = useRegisterWizard();
  const step = wizard?.step ?? 1;
  const stepCount = wizard?.stepCount ?? 3;

  return (
    <div data-testid="register-progress" className="space-y-2">
      <p className="flex items-center justify-between gap-3 text-xs font-semibold text-ink-600">
        <span>
          Step {step} of {stepCount}
          <span className="text-ink-400"> · </span>
          <span className="text-ink-900">{STEP_LABELS[step - 1]}</span>
        </span>
      </p>
      <div
        className="grid grid-cols-3 gap-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={stepCount}
        aria-valuenow={step}
        aria-label="Application steps"
      >
        {STEP_LABELS.slice(0, stepCount).map((label, index) => (
          <span
            key={label}
            className={`h-1 rounded-full transition-colors duration-300 ${
              index + 1 < step
                ? "bg-wellness-500"
                : index + 1 === step
                  ? "bg-clinical-500"
                  : "bg-ink-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
