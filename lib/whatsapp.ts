export function phoneToWaMeLink(phone?: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function buildWhatsAppMessageLink(message: string, phone?: string | null) {
  const text = encodeURIComponent(message);
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) {
    return `https://wa.me/?text=${text}`;
  }
  return `https://wa.me/${digits}?text=${text}`;
}

