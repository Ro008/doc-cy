"use client";

import * as React from "react";
import { AlertCircle, Check } from "lucide-react";
import {
  isRegisterFieldComplete,
  revealRegisterField,
  useRegisterFieldStates,
} from "@/components/auth/useRegisterFieldStates";
import {
  REGISTER_NEXT_EVENT,
  missingFieldsInRegisterStep,
} from "@/components/auth/RegisterWizard";
import { useRegisterWizard } from "@/components/auth/register-wizard-context";

type Props = {
  formId: string;
};

export function RegisterFormValidation({ formId }: Props) {
  const wizard = useRegisterWizard();
  const fields = useRegisterFieldStates(formId);
  const [attempted, setAttempted] = React.useState(false);
  const [touched, setTouched] = React.useState<ReadonlySet<string>>(new Set());
  /**
   * Frozen at the last submit so the list keeps its height while the user works
   * through it — items get ticked off instead of disappearing under the cursor.
   */
  const [reportedKeys, setReportedKeys] = React.useState<string[]>([]);
  const summaryRef = React.useRef<HTMLDivElement>(null);
  const stepRef = React.useRef(wizard?.step ?? 1);
  const stepCountRef = React.useRef(wizard?.stepCount ?? 3);
  stepRef.current = wizard?.step ?? 1;
  stepCountRef.current = wizard?.stepCount ?? 3;

  React.useEffect(() => {
    setAttempted(false);
    setReportedKeys([]);
  }, [wizard?.step]);

  React.useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    // Only blur and edits mark a field as touched. Painting on raw clicks would
    // reveal hints mid-click and shift the layout under an open dropdown.
    const markTouched = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const key = target.closest<HTMLElement>("[data-validate-field='1']")?.dataset.fieldKey;
      if (!key) return;
      setTouched((current) => (current.has(key) ? current : new Set(current).add(key)));
    };

    const reportMissing = (missingFields: HTMLElement[]) => {
      setAttempted(true);
      form.dataset.attempted = "1";
      setReportedKeys(
        missingFields.map((field) => field.dataset.fieldKey ?? "").filter(Boolean),
      );
      const key = missingFields[0]?.dataset.fieldKey;
      if (key) revealRegisterField(form, key);
    };

    const onNext = (event: Event) => {
      const step = Number(
        (event as CustomEvent<{ step?: number }>).detail?.step ??
          form.dataset.wizardStep ??
          "1",
      );
      const missingFields = missingFieldsInRegisterStep(form, step);
      if (missingFields.length === 0) return;
      event.preventDefault();
      reportMissing(missingFields);
    };

    const onSubmit = (event: Event) => {
      if (stepRef.current < stepCountRef.current) {
        event.preventDefault();
        return;
      }
      form.dataset.attempted = "1";
      setAttempted(true);
      if (form.checkValidity()) return;

      event.preventDefault();
      const missingFields = Array.from(
        form.querySelectorAll<HTMLElement>("[data-validate-field='1']"),
      ).filter((field) => !isRegisterFieldComplete(field));
      reportMissing(missingFields);
    };

    form.addEventListener("focusout", markTouched, true);
    form.addEventListener("input", markTouched, true);
    form.addEventListener("change", markTouched, true);
    form.addEventListener("submit", onSubmit, true);
    form.addEventListener(REGISTER_NEXT_EVENT, onNext);

    return () => {
      form.removeEventListener("focusout", markTouched, true);
      form.removeEventListener("input", markTouched, true);
      form.removeEventListener("change", markTouched, true);
      form.removeEventListener("submit", onSubmit, true);
      form.removeEventListener(REGISTER_NEXT_EVENT, onNext);
    };
  }, [formId]);

  // Paint after React has settled so hints never move a field mid-interaction.
  React.useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    for (const field of Array.from(
      form.querySelectorAll<HTMLElement>("[data-validate-field='1']"),
    )) {
      const key = field.dataset.fieldKey ?? "";
      const complete = isRegisterFieldComplete(field);
      const invalid = !complete && (attempted || touched.has(key));

      field.dataset.invalid = invalid ? "1" : "0";
      field.dataset.complete = complete ? "1" : "0";
      field.querySelectorAll<HTMLElement>(".field-hint").forEach((hint) => {
        hint.classList.toggle("hidden", !invalid);
      });
    }
  }, [formId, fields, attempted, touched]);

  const byKey = new Map(fields.map((field) => [field.key, field]));
  const reported = reportedKeys
    .map((key) => byKey.get(key))
    .filter((field): field is NonNullable<typeof field> => Boolean(field));
  const remaining = reported.filter((field) => !field.complete);

  React.useEffect(() => {
    if (reportedKeys.length > 0) {
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [reportedKeys]);

  if (!attempted || remaining.length === 0) return null;

  return (
    <div
      ref={summaryRef}
      role="alert"
      aria-live="assertive"
      data-testid="register-missing-summary"
      className="rounded-2xl border border-amber-300 bg-amber-50 p-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            {remaining.length === 1
              ? "One more thing before you can continue"
              : `${remaining.length} things left before you can continue`}
          </p>
          <p className="mt-1 text-xs text-amber-800">Select one to jump straight to it.</p>
          <ul className="mt-3 space-y-1.5">
            {reported.map((field) => (
              <li key={field.key} className="flex items-center gap-2">
                {field.complete ? (
                  <>
                    <Check className="h-3.5 w-3.5 shrink-0 text-wellness-600" aria-hidden />
                    <span className="text-sm text-amber-800/60 line-through">{field.label}</span>
                  </>
                ) : (
                  <>
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const form = document.getElementById(formId) as HTMLFormElement | null;
                        if (form) revealRegisterField(form, field.key);
                      }}
                      className="text-left text-sm font-medium text-amber-900 underline decoration-amber-400 underline-offset-4 transition hover:text-amber-950 hover:decoration-amber-600"
                    >
                      {field.label}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
