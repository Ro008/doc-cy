/** Footer for manual finder cards (claim link, report incorrect info). */
export const finderCardManualFooterClass = "border-t border-ink-100 pt-4";

/**
 * Mobile: stack, both start-aligned (justify-between looks ragged when the claim wraps).
 * sm+: one row, claim left / report right — both fit on a desktop card.
 */
export const finderCardManualFooterActionsClass =
  "flex flex-col items-start gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-4";
