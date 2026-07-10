/** Build a tel: href from a stored phone string (Cyprus-friendly). */
export function phoneToTelHref(phone?: string | null): string | null {
  const raw = String(phone ?? "").trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("357")) return `tel:+${digits}`;
  if (digits.length === 8) return `tel:+357${digits}`;
  return `tel:+${digits}`;
}
