export const FINDER_MANUAL_CALENDAR_ATTR = "data-finder-manual-calendar";
export const FINDER_MANUAL_SLOT_ATTR = "data-finder-manual-slot";

export type FinderManualSlotClick = {
  manualId: string;
  doctorName: string;
  addressMapsLink: string;
  hasPhone: boolean;
  addressText: string | null;
  slotKey: string;
};

export type FinderManualSlotClickInput = {
  manualId: string;
  doctorName: string;
  mapsLink: string;
  hasPhone: string;
  address: string;
  slotKey: string;
};

/** Parse data attributes from a static manual calendar slot click. */
export function parseFinderManualCalendarClick(
  input: FinderManualSlotClickInput,
): FinderManualSlotClick | null {
  const manualId = String(input.manualId ?? "").trim();
  const slotKey = String(input.slotKey ?? "").trim();
  if (!manualId || !slotKey) return null;
  const address = String(input.address ?? "").trim();
  const hasPhoneRaw = String(input.hasPhone ?? "").trim().toLowerCase();
  return {
    manualId,
    doctorName: String(input.doctorName ?? "").trim(),
    addressMapsLink: String(input.mapsLink ?? "").trim(),
    hasPhone: hasPhoneRaw === "1" || hasPhoneRaw === "true",
    addressText: address ? address : null,
    slotKey,
  };
}
