/** Fired when client navigation starts (progress bar). */
export const NAVIGATION_START_EVENT = "doccy:navigation-start";

/** Fired when the active pending link key changes. */
export const NAVIGATION_PENDING_EVENT = "doccy:navigation-pending";

let pendingLinkKey: string | null = null;
const pendingListeners = new Set<(key: string | null) => void>();

function setPendingLinkKey(key: string | null) {
  if (pendingLinkKey === key) return;
  pendingLinkKey = key;
  pendingListeners.forEach((listener) => listener(pendingLinkKey));
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(NAVIGATION_PENDING_EVENT, { detail: { key: pendingLinkKey } }),
    );
  }
}

export function getNavigationPendingKey(): string | null {
  return pendingLinkKey;
}

export function subscribeNavigationPending(listener: (key: string | null) => void) {
  pendingListeners.add(listener);
  listener(pendingLinkKey);
  return () => {
    pendingListeners.delete(listener);
  };
}

export function clearNavigationPending() {
  setPendingLinkKey(null);
}

export function emitNavigationStart(linkKey?: string) {
  if (typeof window === "undefined") return;
  if (linkKey) {
    setPendingLinkKey(linkKey);
  }
  window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
}
