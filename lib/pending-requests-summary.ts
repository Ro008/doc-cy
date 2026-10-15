/**
 * What the Statistics tab's "Action required" banner says is waiting (user, 2026-10-15):
 * registrations, profile changes, clinic requests and patient reviews, each by its name.
 */
export type PendingRequestCounts = {
  registrations: number;
  profileChanges: number;
  clinicRequests: number;
  reviews: number;
};

export type PendingRequestsSummary = {
  total: number;
  /** "1 patient review", or "3 requests" when more than one kind is waiting; empty for none. */
  headline: string;
  /** "1 registration request, 2 patient reviews" when more than one kind is waiting. */
  breakdown: string | null;
};

const KINDS: ReadonlyArray<{ key: keyof PendingRequestCounts; one: string; many: string }> = [
  { key: "registrations", one: "registration request", many: "registration requests" },
  { key: "profileChanges", one: "profile change request", many: "profile change requests" },
  { key: "clinicRequests", one: "clinic request", many: "clinic requests" },
  { key: "reviews", one: "patient review", many: "patient reviews" },
];

export function pendingRequestsSummary(counts: PendingRequestCounts): PendingRequestsSummary {
  const waiting = KINDS.filter((kind) => counts[kind.key] > 0).map((kind) => ({
    count: counts[kind.key],
    label: counts[kind.key] === 1 ? kind.one : kind.many,
  }));
  const total = waiting.reduce((sum, kind) => sum + kind.count, 0);
  if (waiting.length === 0) return { total: 0, headline: "", breakdown: null };
  const each = waiting.map((kind) => `${kind.count} ${kind.label}`);
  if (waiting.length === 1) return { total, headline: each[0]!, breakdown: null };
  return { total, headline: `${total} requests`, breakdown: each.join(", ") };
}
