/**
 * Client-side "Recently viewed" for finder discovery (localStorage).
 * No server/DB — privacy-friendly MVP for professionals + clinics.
 *
 * Cap is per kind (professionals vs clinics), so each finder strip can show
 * a full row of recent items without the other kind crowding them out.
 */

export type RecentlyViewedKind = "professional" | "clinic";

export type RecentlyViewedItemInput = {
  kind: RecentlyViewedKind;
  /** Canonical profile path used for dedupe + navigation. */
  href: string;
  name: string;
  /** Specialty for professionals; "Clinic" for clinics. */
  subtitle: string;
  location: string;
  photoUrl: string | null;
};

export type RecentlyViewedItem = RecentlyViewedItemInput & {
  viewedAt: number;
};

export const FINDER_RECENTLY_VIEWED_STORAGE_KEY = "doccy.finder.recentlyViewed.v1";
/** Max items stored/shown per kind (professionals and clinics separately). */
export const FINDER_RECENTLY_VIEWED_MAX = 4;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function normalizeHref(href: string): string {
  const raw = String(href ?? "").trim();
  if (!raw) return "";
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return new URL(raw).pathname || "";
    }
  } catch {
    // ignore
  }
  return raw.split("?")[0]?.split("#")[0] || "";
}

function isValidItem(value: unknown): value is RecentlyViewedItem {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const kind = row.kind;
  const href = typeof row.href === "string" ? normalizeHref(row.href) : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (kind !== "professional" && kind !== "clinic") return false;
  if (!href.startsWith("/") || !name) return false;
  return true;
}

function sanitizeItem(input: RecentlyViewedItemInput, viewedAt: number): RecentlyViewedItem | null {
  const href = normalizeHref(input.href);
  const name = String(input.name ?? "").trim();
  if (!href.startsWith("/") || !name) return null;
  const kind: RecentlyViewedKind = input.kind === "clinic" ? "clinic" : "professional";
  const subtitle = String(input.subtitle ?? "").trim() || (kind === "clinic" ? "Clinic" : "");
  const location = String(input.location ?? "").trim();
  const photoRaw = typeof input.photoUrl === "string" ? input.photoUrl.trim() : "";
  return {
    kind,
    href,
    name,
    subtitle,
    location,
    photoUrl: photoRaw || null,
    viewedAt: Number.isFinite(viewedAt) ? viewedAt : Date.now(),
  };
}

/** Keep newest-first order; allow up to MAX items of each kind. */
export function trimRecentlyViewedPerKind(
  items: readonly RecentlyViewedItem[],
  maxPerKind: number = FINDER_RECENTLY_VIEWED_MAX,
): RecentlyViewedItem[] {
  const counts: Record<RecentlyViewedKind, number> = { professional: 0, clinic: 0 };
  const out: RecentlyViewedItem[] = [];
  for (const item of items) {
    if (counts[item.kind] >= maxPerKind) continue;
    counts[item.kind] += 1;
    out.push(item);
  }
  return out;
}

export function readRecentlyViewed(
  storage: StorageLike | null | undefined = typeof window !== "undefined" ? window.localStorage : null,
): RecentlyViewedItem[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(FINDER_RECENTLY_VIEWED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: RecentlyViewedItem[] = [];
    const seen = new Set<string>();
    for (const entry of parsed) {
      if (!isValidItem(entry)) continue;
      const item = sanitizeItem(entry, Number(entry.viewedAt) || Date.now());
      if (!item || seen.has(item.href)) continue;
      seen.add(item.href);
      out.push(item);
    }
    return trimRecentlyViewedPerKind(out);
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(
  input: RecentlyViewedItemInput,
  storage: StorageLike | null | undefined = typeof window !== "undefined" ? window.localStorage : null,
  now: number = Date.now(),
): RecentlyViewedItem[] {
  if (!storage) return [];
  const nextItem = sanitizeItem(input, now);
  if (!nextItem) return readRecentlyViewed(storage);

  const existing = readRecentlyViewed(storage).filter((row) => row.href !== nextItem.href);
  const next = trimRecentlyViewedPerKind([nextItem, ...existing]);

  try {
    storage.setItem(FINDER_RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota / private mode — ignore
  }
  return next;
}
