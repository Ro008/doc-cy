/** Footer for manual finder cards (claim link, report incorrect info). */
export const finderCardManualFooterClass = "border-t border-site-ink-100 pt-4";

/**
 * Every finder card is the same size (user, 2026-10-15): a listing's footer is this tall
 * whether or not "Claim this Profile" shows (a signed-in professional never sees it),
 * and a registered card keeps the same space below its row. Phones stack the two links
 * (claim 29px + gap 12px + report 17px + 16px padding); from `sm` they share one row.
 */
export const finderCardFooterHeightClass = "min-h-[74px] sm:min-h-[46px]";

/**
 * Mobile: stack, both start-aligned (justify-between looks ragged when the claim wraps).
 * `gap-3` keeps the report link's expanded tap target from overlapping the claim pill.
 * sm+: one row, claim left / report right — both fit on a desktop card.
 */
export const finderCardManualFooterActionsClass =
  "flex flex-col items-start gap-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-4";
