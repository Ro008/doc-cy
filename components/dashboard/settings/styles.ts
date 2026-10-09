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

/*
 * One button system for every settings section (user, 2026-10-09: the same kind of
 * control must react the same way on hover). Pick by role, never restyle inline:
 * - PRIMARY: the one main action of a block (Save, Send, Add clinic).
 * - SECONDARY: other actions that are buttons (Edit hours, Preview profile, Copy link).
 * - GHOST: Cancel / dismiss next to a primary.
 * - DANGER: destructive actions that are not the main one (Remove clinic).
 * - LINK: an action written as text (Request a change, Apply to all my clinics).
 *   INLINE_LINK is the same inside a sentence. Links change colour AND underline.
 */
/*
 * Loading rules (user, 2026-10-09), the same everywhere in settings:
 * - Pressed: every button gives under the finger (active:scale).
 * - Waiting: the button that started it shows a spinner and "-ing…" (BusyLabel), is
 *   disabled and aria-busy; a busy button keeps full colour and a progress cursor.
 * - Blocked while waiting: the fields of that block (a <fieldset disabled>), and a
 *   dialog cannot be closed (SettingsDialog `busy`). Controls that save the moment they
 *   change are disabled and show a "Saving…" note (SavingNote).
 * - Done: a toast, replaced rather than stacked (one id per block). When the result
 *   tells the person what to do next ("Check your inbox"), it stays inline instead.
 */
const BUTTON_BASE =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 aria-busy:cursor-progress aria-busy:opacity-100";

export const SETTINGS_PRIMARY_BUTTON_CLASS = `${BUTTON_BASE} bg-clinical-500 font-semibold text-ink-900 hover:bg-clinical-400`;

export const SETTINGS_SECONDARY_BUTTON_CLASS = `${BUTTON_BASE} border border-white/20 font-medium text-slate-100 hover:bg-white/10`;

export const SETTINGS_GHOST_BUTTON_CLASS = `${BUTTON_BASE} font-medium text-slate-300 hover:bg-white/10 hover:text-slate-50`;

export const SETTINGS_DANGER_BUTTON_CLASS = `${BUTTON_BASE} font-medium text-rose-300 hover:bg-rose-500/10 hover:text-rose-200`;

/** Small secondary, for compact rows (Copy next to a script). */
export const SETTINGS_SMALL_SECONDARY_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/20 px-2.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

export const SETTINGS_LINK_CLASS =
  "inline-flex items-center gap-1.5 text-sm font-semibold text-clinical-300 underline-offset-4 transition hover:text-clinical-200 hover:underline disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-progress aria-busy:opacity-100";

export const SETTINGS_INLINE_LINK_CLASS =
  "font-medium text-clinical-300 underline-offset-4 transition hover:text-clinical-200 hover:underline";
