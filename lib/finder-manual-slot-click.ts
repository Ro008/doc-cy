export const FINDER_MANUAL_CALENDAR_ATTR = "data-finder-manual-calendar";
export const FINDER_MANUAL_REQUEST_ATTR = "data-finder-manual-request";

export type FinderManualRequestClick = {
  manualId: string;
};

export type FinderManualRequestClickInput = {
  manualId: string;
};

/** Parse data attributes from a static manual request-booking click. */
export function parseFinderManualRequestClick(
  input: FinderManualRequestClickInput,
): FinderManualRequestClick | null {
  const manualId = String(input.manualId ?? "").trim();
  if (!manualId) return null;
  return { manualId };
}
