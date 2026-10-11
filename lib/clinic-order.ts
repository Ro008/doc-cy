/**
 * The order of a professional's clinics (user, 2026-10-11): there is no "primary
 * clinic". They come by `professional_clinics.sort_order`, then by the date she joined.
 */
export type ClinicOrderFields = { sort_order?: number | null; created_at?: string | null };

export function compareClinicOrder(a: ClinicOrderFields, b: ClinicOrderFields): number {
  const order = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
  if (order !== 0) return order;
  return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
}
