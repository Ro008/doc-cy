/** sessionStorage key for preserving finder/clinics “Show more” scroll. */
export const FINDER_LOAD_MORE_SCROLL_KEY = "doccy:finder-load-more-scroll";

export type FinderLoadMoreScrollSnapshot = {
  scrollY: number;
  documentHeight: number;
};

export function serializeFinderLoadMoreSnapshot(
  snapshot: FinderLoadMoreScrollSnapshot,
): string {
  return JSON.stringify(snapshot);
}

export function parseFinderLoadMoreSnapshot(
  raw: string | null | undefined,
): FinderLoadMoreScrollSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FinderLoadMoreScrollSnapshot>;
    const scrollY = Number(parsed.scrollY);
    const documentHeight = Number(parsed.documentHeight);
    if (!Number.isFinite(scrollY) || !Number.isFinite(documentHeight)) return null;
    if (scrollY < 0 || documentHeight <= 0) return null;
    return { scrollY, documentHeight };
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Capture scroll + document height before a Show more navigation. */
export function markFinderLoadMoreScroll(): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(
    FINDER_LOAD_MORE_SCROLL_KEY,
    serializeFinderLoadMoreSnapshot({
      scrollY: window.scrollY,
      documentHeight: Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
      ),
    }),
  );
}

export function peekFinderLoadMoreScroll(): FinderLoadMoreScrollSnapshot | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  return parseFinderLoadMoreSnapshot(storage.getItem(FINDER_LOAD_MORE_SCROLL_KEY));
}

export function clearFinderLoadMoreScroll(): void {
  getSessionStorage()?.removeItem(FINDER_LOAD_MORE_SCROLL_KEY);
}

/** Restore the pre-click scroll position, then drop the snapshot. */
export function restoreFinderLoadMoreScroll(): boolean {
  const snapshot = peekFinderLoadMoreScroll();
  if (!snapshot) return false;
  window.scrollTo(0, snapshot.scrollY);
  clearFinderLoadMoreScroll();
  return true;
}
