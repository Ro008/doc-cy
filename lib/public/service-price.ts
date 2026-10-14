import { parseServicePrice } from "@/lib/settings-services";

/**
 * A service price on the public profile, with the euro sign as Settings shows it to her:
 * "€100", "From €95" (her "From" tick; the page passes its own word for it). Older free text
 * that is only a number or a range gets the sign too; anything with a currency or other
 * words ("120€", "On request") is shown as written.
 */
export function formatServicePrice(
  raw: string | null | undefined,
  from: (price: string) => string = (price) => `From ${price}`,
): string | null {
  const parts = servicePriceParts(raw);
  if (!parts) return null;
  return parts.from ? from(parts.price) : parts.price;
}

/**
 * The same price in two parts, for the profile's price list, where "from" is small and grey
 * before the amount (user, 2026-10-14): "From 95" → { from: true, price: "€95" }.
 */
export function servicePriceParts(raw: string | null | undefined): { from: boolean; price: string } | null {
  const price = String(raw ?? "").trim();
  if (!price) return null;
  const parsed = parseServicePrice(price);
  if (parsed) return { from: parsed.from, price: `€${parsed.amount}` };
  return { from: false, price: /^[\d\s.,–-]+$/.test(price) ? `€${price}` : price };
}
