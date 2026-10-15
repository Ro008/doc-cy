/**
 * Requests tab: which cards to show. Pending requests are open cards; a request the
 * founder decided in this session stays in its place showing the decision until the
 * page reloads. The refresh after a decision would otherwise drop it at once: it is
 * no longer pending, and decisions on automated-test addresses are not listed at all
 * (lib/registration-review-filter.ts). Older decisions live in "Recent decisions".
 */

export type ReviewDecision = "approved" | "denied";

export type RecentReviewDecision<T> = {
  decision: ReviewDecision;
  /** The request as it was when decided (it may be gone from the refreshed list). */
  item: T;
  /** Its card's place in the list when decided. */
  position: number;
};

export function reviewCardsWithRecentDecisions<T extends { id: string; status: string }>(
  items: readonly T[],
  recent: Readonly<Record<string, RecentReviewDecision<T>>>,
): Array<{ item: T; decision: ReviewDecision | null }> {
  const cards: Array<{ item: T; decision: ReviewDecision | null }> = [];
  for (const item of items) {
    const decided = recent[item.id];
    if (decided) cards.push({ item, decision: decided.decision });
    else if (item.status === "pending") cards.push({ item, decision: null });
  }
  const listed = new Set(items.map((item) => item.id));
  const missing = Object.values(recent)
    .filter((entry) => !listed.has(entry.item.id))
    .sort((a, b) => a.position - b.position);
  for (const entry of missing) {
    const at = Math.min(Math.max(entry.position, 0), cards.length);
    cards.splice(at, 0, { item: entry.item, decision: entry.decision });
  }
  return cards;
}
