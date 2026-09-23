export const registerSectionShell =
  "rounded-3xl border border-clinical-200 bg-white p-5 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(18,184,192,0.06)] sm:p-7";

// 16px text on phones keeps iOS Safari from zooming into the field on focus.
export const registerInputClass =
  "mt-1.5 w-full rounded-[10px] border-[1.5px] border-ink-200 bg-white px-3.5 py-3 text-base text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-clinical-500 focus:ring-4 focus:ring-clinical-500/20 sm:text-[15px]";

export const registerLabelClass = "block text-[13px] font-semibold text-ink-800";

export const registerHelperClass = "mt-1 text-xs leading-relaxed text-ink-500";

export const registerFieldErrorClass =
  "field-hint mt-1 hidden text-xs text-red-600 group-data-[invalid=1]:block";

/** Teal with navy text: brand-bright and still AA contrast (white on #12B8C0 is not). */
export const registerPrimaryButtonClass =
  "inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-clinical-500 px-6 py-3 text-base font-extrabold text-ink-900 shadow-[0_6px_18px_rgba(18,184,192,0.35)] transition hover:bg-clinical-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2";

export const registerSubmitClass = registerPrimaryButtonClass;

export const registerSecondaryButtonClass =
  "inline-flex w-full items-center justify-center rounded-xl border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-800 transition hover:border-clinical-300 hover:text-clinical-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50 sm:w-auto";
