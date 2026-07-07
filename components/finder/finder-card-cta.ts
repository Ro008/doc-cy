/** Shared primary CTA sizing for finder list cards (registered + manual). */
export const finderCardCtaColumnWidthClass = "w-full shrink-0 sm:w-[168px] lg:w-[176px]";

export const finderCardCtaColumnClass = `flex flex-col justify-center ${finderCardCtaColumnWidthClass}`;

export const finderCardManualCtaColumnClass = `flex flex-col justify-between gap-3 border-t border-ink-100 pt-4 sm:border-t-0 sm:pt-0 ${finderCardCtaColumnWidthClass}`;

export const finderCardPrimaryCtaClass =
  "box-border flex h-14 w-full shrink-0 items-center justify-center rounded-xl bg-clinical-500 px-3 text-center text-sm font-semibold leading-snug text-white shadow-[0_4px_14px_rgba(11,123,181,0.35)] transition hover:bg-clinical-400 hover:shadow-[0_6px_18px_rgba(11,123,181,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-[168px] lg:w-[176px]";
