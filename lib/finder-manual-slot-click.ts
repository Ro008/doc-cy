export const FINDER_MANUAL_CALENDAR_ATTR = "data-finder-manual-calendar";
export const FINDER_MANUAL_REQUEST_ATTR = "data-finder-manual-request";

export type FinderManualRequestClick = {
  manualId: string;
  clinicId: string | null;
  source: string | null;
};

export type FinderManualRequestClickInput = {
  manualId: string;
  clinicId?: string | null;
  source?: string | null;
};

/** Parse data attributes from a static manual request-booking click. */
export function parseFinderManualRequestClick(
  input: FinderManualRequestClickInput,
): FinderManualRequestClick | null {
  const manualId = String(input.manualId ?? "").trim();
  if (!manualId) return null;
  const clinicId = String(input.clinicId ?? "").trim() || null;
  const source = String(input.source ?? "").trim() || null;
  return { manualId, clinicId, source };
}
