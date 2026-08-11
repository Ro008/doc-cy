/**
 * Shared finder surfaces: soft elevation + brand-tint hover (DocCy tokens).
 * Prefer transform/shadow/border transitions only — avoid animating layout-heavy props.
 */

/** Result cards (professionals + clinics lists). */
export const finderResultCardClass =
  "rounded-2xl border border-clinical-200 bg-white p-4 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_4px_16px_rgba(18,184,192,0.05)] sm:p-5 motion-safe:transition-[border-color,background-color] motion-safe:duration-150 motion-safe:ease-out hover:border-clinical-300 hover:bg-clinical-50";

/** Clickable browse / SEO rows (district × specialty links). */
export const finderBrowseRowClass =
  "block rounded-xl px-2.5 py-2 text-sm text-ink-700 no-underline transition-[background-color,color,box-shadow] duration-150 hover:bg-clinical-50 hover:text-clinical-800 hover:shadow-[0_1px_4px_rgba(18,184,192,0.08)]";

export const finderBrowseRowCompactClass =
  "block rounded-lg px-2 py-1.5 text-xs text-ink-600 no-underline transition-[background-color,color,box-shadow] duration-150 hover:bg-clinical-50 hover:text-clinical-800 hover:shadow-[0_1px_4px_rgba(18,184,192,0.08)]";

/** Secondary CTAs in the results column (e.g. Show more). */
export const finderSoftButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-clinical-200 bg-white px-5 text-sm font-semibold text-clinical-700 shadow-[0_1px_3px_rgba(26,43,60,0.05)] motion-safe:transition-[transform,box-shadow,border-color,background-color] motion-safe:duration-200 hover:border-clinical-300 hover:bg-clinical-50 hover:shadow-[0_6px_18px_rgba(18,184,192,0.12)] motion-safe:hover:-translate-y-0.5";

/** Compact horizontal cards in the Recently viewed strip (no lift — keeps the scroller snappy). */
export const finderRecentlyViewedCardClass =
  "rounded-xl border border-clinical-200 bg-white px-3 py-2.5 shadow-[0_1px_3px_rgba(26,43,60,0.05)] motion-safe:transition-[border-color,background-color] motion-safe:duration-150 motion-safe:ease-out hover:border-clinical-300 hover:bg-clinical-50";
