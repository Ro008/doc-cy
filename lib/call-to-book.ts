import type { UserEventStatRow } from "@/lib/user-events";

/**
 * Where a phone button is, as the page sends it. The server adds whether the professional
 * is registered (`userEventSourceFor` in lib/user-events.ts) before it stores the click.
 */
export const CALL_TO_BOOK_SOURCES = ["finder_card", "professional_profile_page", "clinic_page"] as const;

export type CallToBookSource = (typeof CALL_TO_BOOK_SOURCES)[number];

export const CALL_TO_BOOK_BUTTON_LABEL = "Show phone number";

/** Older source labels for `/finder/professional/{slug}`. */
const LEGACY_PROFESSIONAL_PROFILE_SOURCES = new Set(["professional_landing", "profile_page"]);

export function parseCallToBookSource(value: unknown): CallToBookSource | null {
  const raw = String(value ?? "").trim();
  if (LEGACY_PROFESSIONAL_PROFILE_SOURCES.has(raw)) return "professional_profile_page";
  return (CALL_TO_BOOK_SOURCES as readonly string[]).includes(raw)
    ? (raw as CallToBookSource)
    : null;
}

export type CallToBookProfessionalAgg = {
  manualId: string;
  count: number;
  lastAt: string;
  finderCount: number;
  professionalProfileCount: number;
};

export type CallToBookTotals = {
  total: number;
  finderCount: number;
  professionalProfileCount: number;
  byProfessional: CallToBookProfessionalAgg[];
};

/** One row from `founder_user_event_stats('show_clinic_phone_number', …)`: every click counts. */
export type CallToBookStatRow = UserEventStatRow;

/** Totals across every stat row — the database already grouped by professional, so this is a plain sum. */
export function sumCallToBookStats(
  stats: readonly CallToBookStatRow[],
): Pick<CallToBookTotals, "total" | "finderCount" | "professionalProfileCount"> {
  let total = 0;
  let finderCount = 0;
  let professionalProfileCount = 0;
  for (const row of stats) {
    total += Number(row.event_count) || 0;
    finderCount += Number(row.finder_count) || 0;
    professionalProfileCount += Number(row.profile_count) || 0;
  }
  return { total, finderCount, professionalProfileCount };
}

/**
 * Maps pre-aggregated click stats onto dashboard rows, filling in professional
 * metadata. Return shape matches `CallToBookDashboardRow`
 * (components/internal/CallToBookClicksSection.tsx).
 */
export function buildCallToBookDashboardRows(
  stats: readonly CallToBookStatRow[],
  metaById: ReadonlyMap<string, { name?: string | null; district?: string | null; specialty?: string | null }>,
) {
  return stats.map((row) => {
    const id = String(row.professional_id ?? "");
    const meta = metaById.get(id);
    return {
      manualId: id,
      name: meta?.name?.trim() || id.slice(0, 8),
      district: meta?.district ?? null,
      specialty: meta?.specialty ?? null,
      count: Number(row.event_count) || 0,
      finderCount: Number(row.finder_count) || 0,
      professionalProfileCount: Number(row.profile_count) || 0,
      lastAt: String(row.last_at ?? ""),
    };
  });
}
