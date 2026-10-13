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
  const price = String(raw ?? "").trim();
  if (!price) return null;
  const parsed = parseServicePrice(price);
  if (parsed) return parsed.from ? from(`€${parsed.amount}`) : `€${parsed.amount}`;
  return /^[\d\s.,–-]+$/.test(price) ? `€${price}` : price;
}
