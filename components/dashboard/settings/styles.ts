/**
 * Shared look of the settings sections (design B1), so cards rendered outside
 * SettingsForm (Account, Promote) match the rest of the page.
 */

export const SETTINGS_CARD_CLASS =
  "rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-xl shadow-black/20 sm:p-6";

export const SETTINGS_EYEBROW_CLASS = "text-xs font-semibold uppercase tracking-[0.14em] text-slate-500";

/** A titled row: label and description on the left, its action on the right. */
export const SETTINGS_ROW_CLASS =
  "flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6";

export const SETTINGS_SECONDARY_BUTTON_CLASS =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-3.5 py-2 text-sm font-semibold text-slate-100 transition hover:border-clinical-400/50 hover:text-clinical-100 disabled:cursor-not-allowed disabled:opacity-60";
