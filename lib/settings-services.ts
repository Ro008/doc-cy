/**
 * Settings → Services & prices (user, 2026-10-10): a price list on her public profile.
 * Each service has a name and an optional price in euros, exact ("120") or a lowest
 * price ("From 80"); the price stays text in `professional_services.price`. At most 20,
 * and no name twice. The page checks with these before sending; the server and the
 * database functions check again.
 */

export const MAX_SERVICES = 20;
export const SERVICE_NAME_MAX = 80;

export type ServiceInput = { name: string; price: string | null };
export type SavedService = ServiceInput & { id: string };
export type ServicePrice = { amount: string; from: boolean };
export type ServiceErrors = { name?: string; price?: string };
// Optional `undefined` fields on each branch: no strictNullChecks in this project.
export type ServiceCheck =
  | { ok: true; service: ServiceInput; errors?: undefined }
  | { ok: false; errors: ServiceErrors; service?: undefined };

const AMOUNT = /^\d{1,5}(?:[.,]\d{1,2})?$/;
const STORED = /^(from\s+)?(\d{1,5}(?:\.\d{1,2})?)$/i;
const PRICE_MESSAGE = "Enter an amount in euros, for example 60 or 49.50.";

/** A stored price as its amount and whether it is a lowest price; null when there is none or it is older free text. */
export function parseServicePrice(price: unknown): ServicePrice | null {
  if (typeof price !== "string") return null;
  const match = STORED.exec(price.trim());
  return match ? { amount: match[2], from: Boolean(match[1]) } : null;
}

export function storedServicePrice(price: ServicePrice | null): string | null {
  if (!price) return null;
  return price.from ? `From ${price.amount}` : price.amount;
}

/** How a price reads on the list: "€120", "From €80"; older free text as it is. */
export function formatServicePrice(price: string | null | undefined): string | null {
  const text = String(price ?? "").trim();
  if (!text) return null;
  const parsed = parseServicePrice(text);
  if (!parsed) return text;
  return parsed.from ? `From €${parsed.amount}` : `€${parsed.amount}`;
}

/** "080.00" → "80", "49,5" → "49.50". */
function tidyAmount(typed: string): string {
  const [whole, cents = ""] = typed.replace(",", ".").split(".");
  const euros = String(Number(whole));
  return Number(cents) > 0 ? `${euros}.${cents.padEnd(2, "0")}` : euros;
}

const singleSpaced = (value: string) => value.replace(/\s+/g, " ").trim();

export function validateService(typed: { name: string; price: string; priceFrom: boolean }): ServiceCheck {
  const errors: ServiceErrors = {};
  const name = singleSpaced(typed.name);
  if (!name) errors.name = "Enter the name of the service.";
  else if (name.length > SERVICE_NAME_MAX) errors.name = `Use ${SERVICE_NAME_MAX} characters or fewer.`;

  const amount = typed.price.trim();
  let price: string | null = null;
  if (!amount) {
    if (typed.priceFrom) errors.price = "Enter the lowest price, or untick From.";
  } else if (!AMOUNT.test(amount)) {
    errors.price = PRICE_MESSAGE;
  } else {
    price = storedServicePrice({ amount: tidyAmount(amount), from: typed.priceFrom });
  }

  if (errors.name || errors.price) return { ok: false, errors };
  return { ok: true, service: { name, price } };
}

/** A service as the API receives it: { name, price: amount | null, priceFrom? }. */
export function serviceFromBody(body: unknown): ServiceCheck {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof b.name !== "string") return { ok: false, errors: { name: "Enter the name of the service." } };
  const noPrice = b.price === null || b.price === undefined;
  if (!noPrice && typeof b.price !== "string" && typeof b.price !== "number") {
    return { ok: false, errors: { price: PRICE_MESSAGE } };
  }
  return validateService({ name: b.name, price: noPrice ? "" : String(b.price), priceFrom: b.priceFrom === true });
}

const nameKey = (name: string) => singleSpaced(name).toLowerCase();

/** Whether she already lists this name (capitals and spaces aside), other than `exceptId`. */
export function serviceNameTaken(list: SavedService[], name: string, exceptId?: string): boolean {
  const key = nameKey(name);
  return list.some((row) => row.id !== exceptId && nameKey(row.name) === key);
}

/** Rows of `professional_services` (or an API answer) as the page uses them. */
export function parseSavedServices(value: unknown): SavedService[] {
  if (!Array.isArray(value)) return [];
  const list: SavedService[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const { id, name, price } = row as Record<string, unknown>;
    const cleanName = typeof name === "string" ? name.trim() : "";
    if (typeof id !== "string" || !id || !cleanName) continue;
    const cleanPrice = typeof price === "string" ? price.trim() : "";
    list.push({ id, name: cleanName, price: cleanPrice || null });
  }
  return list;
}
