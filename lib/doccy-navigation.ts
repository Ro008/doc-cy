/** Fired when client navigation starts (progress bar + pending link states). */
export const NAVIGATION_START_EVENT = "doccy:navigation-start";

export function emitNavigationStart(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
}
