/** Query param + helpers for deep-linking a Cyprus wall-clock slot into BookingSection. */

export const BOOKING_SLOT_QUERY = "slot";
export const BOOKING_LOCATION_QUERY = "location";

const SLOT_KEY_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Returns a normalized `YYYY-MM-DDTHH:mm` slot key, or null if invalid. */
export function parseBookingSlotParam(
  value: string | null | undefined,
): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!SLOT_KEY_RE.test(raw)) return null;
  return raw;
}

/** Public profile href; optional slot preselect (`?slot=YYYY-MM-DDTHH:mm`). */
export function buildDoctorBookingHref(
  profileSlug: string,
  slotKey?: string | null,
  locationId?: string | null,
): string {
  const slug = profileSlug.replace(/^\/+/, "");
  const base = `/${slug}`;
  const params = new URLSearchParams();
  const slot = parseBookingSlotParam(slotKey ?? null);
  if (slot) params.set(BOOKING_SLOT_QUERY, slot);
  const location = String(locationId ?? "").trim();
  if (location) params.set(BOOKING_LOCATION_QUERY, location);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function parseBookingLocationParam(
  value: string | null | undefined,
): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  return raw;
}

export function bookingSlotDateFromKey(slotKey: string): Date | null {
  const parsed = parseBookingSlotParam(slotKey);
  if (!parsed) return null;
  const [datePart] = parsed.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
