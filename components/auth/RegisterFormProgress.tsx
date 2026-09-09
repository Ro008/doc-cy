"use client";

import { useRegisterWizard } from "@/components/auth/register-wizard-context";

const STEP_LABELS = ["Account", "Profile", "Practice"] as const;

export function RegisterFormProgress({ formId: _formId }: { formId: string }) {
  const wizard = useRegisterWizard();
  const step = wizard?.step ?? 1;
  const stepCount = wizard?.stepCount ?? 3;

  return (
    <div data-testid="register-progress" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <ol className="flex min-w-0 items-center gap-2 text-xs font-semibold">
          {STEP_LABELS.slice(0, stepCount).map((label, index) => {
            const n = index + 1;
            const current = n === step;
            const doneStep = n < step;
            return (
              <li
                key={label}
                className={`flex min-w-0 items-center gap-1.5 ${
                  current ? "text-clinical-700" : doneStep ? "text-wellness-700" : "text-ink-400"
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    current
                      ? "bg-clinical-500 text-white"
                      : doneStep
                        ? "bg-wellness-500 text-white"
                        : "bg-ink-200 text-ink-600"
                  }`}
                >
                  {n}
                </span>
                <span className="hidden sm:inline">{label}</span>
                {index < stepCount - 1 ? (
                  <span className="mx-1 hidden h-px w-8 bg-ink-200 sm:block" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
        <p className="shrink-0 text-xs font-medium text-ink-500">
          Step {step} of {stepCount}
        </p>
      </div>

      <div
        className="h-1 w-full overflow-hidden rounded-full bg-ink-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={stepCount}
        aria-valuenow={step}
        aria-label="Application steps"
      >
        <div
          className="h-full rounded-full bg-clinical-500 transition-all duration-300"
          style={{ width: `${(step / stepCount) * 100}%` }}
        />
      </div>
    </div>
  );
}
