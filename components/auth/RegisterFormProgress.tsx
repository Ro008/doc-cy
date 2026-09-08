"use client";

import { CheckCircle2 } from "lucide-react";
import {
  revealRegisterField,
  useRegisterFieldStates,
} from "@/components/auth/useRegisterFieldStates";

export function RegisterFormProgress({ formId }: { formId: string }) {
  const fields = useRegisterFieldStates(formId);
  if (fields.length === 0) return null;

  const done = fields.filter((field) => field.complete).length;
  const total = fields.length;
  const nextUp = fields.find((field) => !field.complete);
  const percent = Math.round((done / total) * 100);

  return (
    <div data-testid="register-progress" className="rounded-2xl border border-ink-200 bg-ink-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-800">
          {nextUp ? (
            <>
              {done} of {total} completed
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-wellness-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Everything is filled in
            </span>
          )}
        </p>
        <p className="text-xs font-semibold tabular-nums text-ink-500">{percent}%</p>
      </div>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Application progress"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            nextUp ? "bg-clinical-500" : "bg-wellness-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {nextUp ? (
        <p className="mt-2 text-xs text-ink-600">
          Next:{" "}
          <button
            type="button"
            onClick={() => {
              const form = document.getElementById(formId) as HTMLFormElement | null;
              if (form) revealRegisterField(form, nextUp.key);
            }}
            className="font-semibold text-clinical-700 underline underline-offset-2 transition hover:text-clinical-600"
          >
            {nextUp.label}
          </button>
        </p>
      ) : null}
    </div>
  );
}
