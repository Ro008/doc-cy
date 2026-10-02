/**
 * A service price as the professional typed it ("100", "From 50€", "On request").
 * A bare number (or range) gets the euro sign after it; anything with a currency or
 * words is shown as written.
 */
export function formatServicePrice(raw: string | null | undefined): string | null {
  const price = String(raw ?? "").trim();
  if (!price) return null;
  return /^[\d\s.,–-]+$/.test(price) ? `${price} €` : price;
}
