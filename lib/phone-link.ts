/** Digits only, with Cyprus country code when the number is local (8 digits). */
export function cyprusPhoneDigits(phone?: string | null): string | null {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("357")) return digits;
  if (digits.length === 8) return `357${digits}`;
  return digits;
}

/** Build a tel: href from a stored phone string (Cyprus-friendly). */
export function phoneToTelHref(phone?: string | null): string | null {
  const digits = cyprusPhoneDigits(phone);
  if (!digits) return null;
  return `tel:+${digits}`;
}

/**
 * Display format with +357 for Cyprus numbers.
 * 8-digit national: +357 XX XXXXXX (e.g. +357 99 123456).
 */
export function formatCyprusPhoneDisplay(phone?: string | null): string {
  const raw = String(phone ?? "").trim();
  const digits = cyprusPhoneDigits(phone);
  if (!digits) return raw;
  if (digits.startsWith("357") && digits.length === 11) {
    const national = digits.slice(3);
    return `+357 ${national.slice(0, 2)} ${national.slice(2)}`;
  }
  if (digits.startsWith("357")) return `+${digits}`;
  return `+${digits}`;
}
