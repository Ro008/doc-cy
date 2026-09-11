/** Footer for manual finder cards (claim link, report incorrect info). */
export const finderCardManualFooterClass = "border-t border-ink-100 pt-4";

/**
 * Mobile: stack, both start-aligned (justify-between looks ragged when the claim wraps).
 * `gap-3` keeps the report link's expanded tap target from overlapping the claim pill.
 * sm+: one row, claim left / report right — both fit on a desktop card.
 */
export const finderCardManualFooterActionsClass =
  "flex flex-col items-start gap-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-4";
