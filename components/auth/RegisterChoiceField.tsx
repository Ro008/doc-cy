import { registerFieldErrorClass, registerLabelClass } from "@/lib/register-ui";

type RegisterChoiceOption = {
  value: string;
  label: string;
};

/**
 * Required single choice drawn as pills over real radios, so keyboard, screen
 * readers and the wizard's validity checks (a required radio group is invalid
 * until one option is picked) all work without extra JS.
 */
export function RegisterChoiceField({
  name,
  fieldKey,
  fieldLabel,
  question,
  options,
  errorMessage,
  defaultValue,
}: {
  name: string;
  fieldKey: string;
  /** Short name used in the "things left" summary. */
  fieldLabel: string;
  /** Visible question, also the radio group's accessible name. */
  question: string;
  options: readonly RegisterChoiceOption[];
  errorMessage: string;
  /** Preselected option (claim prefill); omit to start unanswered. */
  defaultValue?: string | null;
}) {
  const questionId = `register-${fieldKey}-question`;
  return (
    <div
      className="group"
      data-validate-field="1"
      data-invalid="0"
      data-field-key={fieldKey}
      data-field-label={fieldLabel}
      // The highlighted pill already shows the answer; the generic corner tick sat
      // next to the last option and read as "Female / No selected".
      data-complete-tick="off"
    >
      {/* Compact: question and a small segmented control share one line. */}
      <div className="flex items-center justify-between gap-3">
        <p id={questionId} className={registerLabelClass}>
          {question}
          <span className="text-red-600">*</span>
        </p>
        <div
          role="radiogroup"
          aria-labelledby={questionId}
          className="inline-flex shrink-0 rounded-lg border-[1.5px] border-ink-200 bg-white p-0.5 group-data-[invalid=1]:border-red-300"
        >
          {options.map((option) => (
            <label key={option.value} className="relative cursor-pointer">
              <input
                type="radio"
                name={name}
                value={option.value}
                defaultChecked={defaultValue === option.value}
                required
                className="peer sr-only"
              />
              <span className="flex h-8 min-w-[52px] items-center justify-center rounded-md px-3 text-sm font-semibold text-ink-600 transition hover:text-ink-900 peer-checked:bg-clinical-500 peer-checked:text-ink-900 peer-focus-visible:ring-2 peer-focus-visible:ring-clinical-500/40">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>
      <p className={registerFieldErrorClass}>{errorMessage}</p>
    </div>
  );
}
