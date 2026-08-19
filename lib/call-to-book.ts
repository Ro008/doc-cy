export const CALL_TO_BOOK_SOURCES = ["finder_card", "professional_profile_page"] as const;

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

export type CallToBookClickEvent = {
  manualId: string;
  clinicId: string | null;
  source: string;
  createdAt: string;
};

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

/** Group raw click rows for the founder dashboard (count, last click, finder vs professional profile). */
export function aggregateCallToBookClicks(events: readonly CallToBookClickEvent[]): CallToBookTotals {
  const byManual = new Map<string, CallToBookProfessionalAgg>();
  let finderCount = 0;
  let professionalProfileCount = 0;

  for (const event of events) {
    const manualId = String(event.manualId ?? "").trim();
    if (!manualId) continue;
    const source = parseCallToBookSource(event.source);
    if (source === "finder_card") finderCount += 1;
    else if (source === "professional_profile_page") professionalProfileCount += 1;

    const createdAt = String(event.createdAt ?? "");
    const cur = byManual.get(manualId);
    if (!cur) {
      byManual.set(manualId, {
        manualId,
        count: 1,
        lastAt: createdAt,
        finderCount: source === "finder_card" ? 1 : 0,
        professionalProfileCount: source === "professional_profile_page" ? 1 : 0,
      });
      continue;
    }
    cur.count += 1;
    if (createdAt > cur.lastAt) cur.lastAt = createdAt;
    if (source === "finder_card") cur.finderCount += 1;
    if (source === "professional_profile_page") cur.professionalProfileCount += 1;
  }

  const byProfessional = Array.from(byManual.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.manualId.localeCompare(b.manualId);
  });

  return {
    total: events.filter((e) => String(e.manualId ?? "").trim()).length,
    finderCount,
    professionalProfileCount,
    byProfessional,
  };
}
