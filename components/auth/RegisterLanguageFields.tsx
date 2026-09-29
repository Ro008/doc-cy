"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { registerLanguageOptions } from "@/lib/register-languages";
import { registerFieldErrorClass, registerHelperClass, registerLabelClass } from "@/lib/register-ui";

/**
 * Languages as one-click pills (real checkboxes named `language`, so the form
 * posts them as before). Brand colours on purpose: the per-language colours are
 * for the patient-facing finder and profile, not this form.
 */
export function RegisterLanguageFields() {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [expanded, setExpanded] = React.useState(false);
  const { visible, hiddenCount } = registerLanguageOptions(selected, expanded);

  const toggle = (label: string, checked: boolean) => {
    setSelected((current) =>
      checked ? [...current, label] : current.filter((item) => item !== label),
    );
  };

  return (
    <div
      className="group"
      data-validate-field="1"
      data-invalid="0"
      data-field-key="languages"
      data-field-label="Languages you speak"
    >
      <p id="register-languages-label" className={registerLabelClass}>
        Languages you consult in<span className="text-red-600">*</span>
      </p>
      <p className={registerHelperClass}>
        Patients filter by language to find you. Pick all that apply.
      </p>
      <div
        role="group"
        aria-labelledby="register-languages-label"
        className="mt-2 flex flex-wrap items-center gap-2"
      >
        {visible.map((label, index) => {
          const checked = selected.includes(label);
          return (
            <label
              key={label}
              data-testid={`language-option-${label.replace(/\s+/g, "-")}`}
              className="relative cursor-pointer"
            >
              <input
                type="checkbox"
                name="language"
                value={label}
                checked={checked}
                onChange={(event) => toggle(label, event.target.checked)}
                data-focus-target={index === 0 ? "true" : undefined}
                className="peer sr-only"
              />
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-ink-200 bg-white px-3.5 text-sm font-semibold text-ink-700 transition hover:border-clinical-300 peer-checked:border-clinical-500 peer-checked:bg-clinical-500 peer-checked:text-ink-900 peer-focus-visible:ring-4 peer-focus-visible:ring-clinical-500/25 group-data-[invalid=1]:border-red-300 group-data-[invalid=1]:peer-checked:border-clinical-500">
                {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : null}
                {label}
              </span>
            </label>
          );
        })}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-clinical-800 transition hover:bg-clinical-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500"
        >
          {expanded ? "Fewer languages" : `More languages (${hiddenCount})`}
          <ChevronDown
            className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>
      <input
        type="text"
        data-validity-proxy="true"
        required
        value={selected.length > 0 ? "ok" : ""}
        // A readonly input is barred from constraint validation, which would make
        // this required field silently always valid. The no-op keeps React quiet.
        onChange={() => {}}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      <p className={registerFieldErrorClass}>Pick at least one language.</p>
    </div>
  );
}
