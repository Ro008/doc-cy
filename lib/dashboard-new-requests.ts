/**
 * "1 new request · Show" on the dashboard (user, 2026-10-09). New requests are announced,
 * not slid in, so a row never moves under her finger while she answers another one.
 * Two signals: Realtime on `appointments` (instant) and the pending count every minute
 * and on focus (catches a dropped connection or a sleeping laptop).
 */

/** How often the dashboard re-checks the pending count behind Realtime's back. */
export const NEW_REQUESTS_POLL_MS = 60_000;

/** How long rows brought in by Show stay marked. */
export const NEW_REQUESTS_HIGHLIGHT_MS = 3000;

/**
 * Track the requests Realtime announced: a future REQUESTED row is added; any other
 * state of a known row (accepted or declined elsewhere, expired) removes it.
 * Returns the same set when nothing changes, so React can skip the render.
 */
export function applyRealtimeRequestChange(
  arrived: ReadonlySet<string>,
  raw: Record<string, unknown> | null | undefined,
  nowMs: number,
): ReadonlySet<string> {
  const id = typeof raw?.id === "string" ? raw.id : null;
  if (!id) return arrived;
  const isRequest = String(raw?.status ?? "").trim().toUpperCase() === "REQUESTED";
  const startMs = Date.parse(String(raw?.appointment_datetime ?? ""));
  const counts = isRequest && Number.isFinite(startMs) && startMs > nowMs;
  if (counts === arrived.has(id)) return arrived;
  const next = new Set(arrived);
  if (counts) next.add(id);
  else next.delete(id);
  return next;
}

/**
 * How many more requests the server has than the dashboard showed when the count came back.
 * Worked out at that moment, so answering a request afterwards cannot turn the stale count
 * into a phantom "new request".
 */
export function serverExtraCount(serverPendingCount: number | null, shownCountAtAnswer: number): number {
  if (serverPendingCount === null) return 0;
  return Math.max(serverPendingCount - shownCountAtAnswer, 0);
}

/**
 * Requests waiting that are not on screen. The larger of the two signals, never their sum:
 * both usually see the same request.
 */
export function newRequestsCount(input: {
  arrivedIds: ReadonlySet<string>;
  shownIds: ReadonlySet<string>;
  serverExtra: number;
}): number {
  let arrivedNotShown = 0;
  for (const id of input.arrivedIds) if (!input.shownIds.has(id)) arrivedNotShown += 1;
  return Math.max(arrivedNotShown, input.serverExtra, 0);
}

/** Rows that came in with the refresh, in list order, to highlight. */
export function freshlyShownIds(before: ReadonlySet<string>, after: readonly string[]): string[] {
  return after.filter((id) => !before.has(id));
}

export function newRequestsLabel(count: number): string {
  return `${count} new request${count === 1 ? "" : "s"}`;
}
