/** Fired when client navigation starts (progress bar). */
export const NAVIGATION_START_EVENT = "doccy:navigation-start";

export type NavigationStartReason =
  | "default"
  | "finder-results"
  | "finder-near-me"
  | "clinics-near-me"
  | "profile";

export type NavigationStartDetail = {
  linkKey?: string;
  reason?: NavigationStartReason;
};

const NAVIGATION_START_MESSAGES: Record<NavigationStartReason, string> = {
  default: "Loading...",
  "finder-results": "Updating results...",
  "finder-near-me": "Finding doctors near you...",
  "clinics-near-me": "Finding clinics near you...",
  profile: "Opening booking page...",
};

export function getNavigationStartMessage(
  reason: NavigationStartReason = "default",
): string {
  return NAVIGATION_START_MESSAGES[reason];
}

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

export function emitNavigationStart(
  linkKey?: string,
  reason: NavigationStartReason = "default",
) {
  if (typeof window === "undefined") return;
  if (linkKey) {
    setPendingLinkKey(linkKey);
  }
  window.dispatchEvent(
    new CustomEvent<NavigationStartDetail>(NAVIGATION_START_EVENT, {
      detail: { linkKey, reason },
    }),
  );
}
