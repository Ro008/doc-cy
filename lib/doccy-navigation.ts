/** Fired when client navigation starts (progress bar). */
export const NAVIGATION_START_EVENT = "doccy:navigation-start";

export type NavigationStartReason =
  | "default"
  | "finder-results"
  | "finder-load-more"
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
  "finder-load-more": "Loading more...",
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

/** Compare a Next.js <Link> href to the current App Router location. */
export function hrefMatchesCurrentLocation(
  href: string,
  pathname: string,
  search: string | { toString(): string },
): boolean {
  try {
    const target = new URL(href, "https://doccy.invalid");
    if (target.pathname !== pathname) return false;
    const currentSearch =
      typeof search === "string" ? search.replace(/^\?/, "") : search.toString();
    return target.searchParams.toString() === currentSearch;
  } catch {
    return false;
  }
}

/**
 * Same-URL <Link> clicks do not change searchParams, so pending would never clear.
 * Skip the spinner in that case (unfiltered Show more used to hang on /?page=3).
 */
export function shouldStartLinkNavigationPending(
  href: string,
  pathname: string,
  search: string | { toString(): string },
): boolean {
  return !hrefMatchesCurrentLocation(href, pathname, search);
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
