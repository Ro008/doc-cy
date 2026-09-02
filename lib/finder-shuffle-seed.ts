const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Session cookie: keeps tied-bucket shuffle stable across Show more / refresh. */
export const FINDER_SHUFFLE_SEED_COOKIE = "doccy_finder_shuffle_seed";

export function isFinderShuffleSeed(value: string | null | undefined): boolean {
  return UUID_RE.test(String(value ?? "").trim());
}

export function readFinderShuffleSeed(cookieRaw: string | null | undefined): string | null {
  const value = String(cookieRaw ?? "").trim();
  return isFinderShuffleSeed(value) ? value : null;
}

export function resolveFinderShuffleSeed(cookieRaw: string | null | undefined): {
  seed: string;
  persist: boolean;
} {
  const existing = readFinderShuffleSeed(cookieRaw);
  if (existing) return { seed: existing, persist: false };
  return { seed: crypto.randomUUID(), persist: true };
}

export function finderShuffleSeedCookieWriteValue(seed: string): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? ";Secure" : "";
  return `${FINDER_SHUFFLE_SEED_COOKIE}=${encodeURIComponent(seed)};Path=/;SameSite=Lax${secure}`;
}

export function writeFinderShuffleSeedCookie(seed: string): void {
  if (typeof document === "undefined") return;
  if (!isFinderShuffleSeed(seed)) return;
  document.cookie = finderShuffleSeedCookieWriteValue(seed);
}

/** Combine browser session + current list so Show more stays stable on this URL. */
export function buildFinderManualShuffleSeed(listScope: string, sessionSeed: string): string {
  return `${sessionSeed}|${listScope}`;
}
