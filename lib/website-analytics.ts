export type WebsiteVisitRow = {
  session_id: string;
  page_path: string;
  city: string | null;
  country: string | null;
  traffic_origin: "direct" | "ref";
  ref_code: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  created_at: string;
};

/** Printed business card QR: ?utm_source=offline&utm_medium=business_card */
export function isBusinessCardUtmVisit(row: WebsiteVisitRow): boolean {
  const src = (row.utm_source ?? "").trim().toLowerCase();
  const med = (row.utm_medium ?? "").trim().toLowerCase();
  return src === "offline" && med === "business_card";
}

export function countBusinessCardVisits(rows: WebsiteVisitRow[]): number {
  return rows.filter(isBusinessCardUtmVisit).length;
}

/** Everything else we log: direct URL, search, bookmarks, other UTMs, ?ref=, etc. */
export function countWebsiteAndLinkVisits(rows: WebsiteVisitRow[]): number {
  return rows.filter((r) => !isBusinessCardUtmVisit(r)).length;
}

export type LocalityCount = {
  locality: string;
  count: number;
};

export type SectionCount = {
  section: string;
  count: number;
  percent: number;
};

export type HighInterestSession = {
  sessionId: string;
  pagesVisited: number;
  pageViews: number;
  lastSeenAt: string;
  locality: string;
  origin: "direct" | "ref";
  refCode: string | null;
};

export function mapPathToSection(path: string): string {
  if (path === "/") return "Product Tour";
  if (path.startsWith("/register")) return "Signup";
  if (path.startsWith("/login")) return "Login";
  if (path.startsWith("/reschedule")) return "Reschedule";
  if (path.startsWith("/internal")) return "Internal";
  if (path.startsWith("/agenda")) return "Agenda";
  return "Other";
}

export function formatLocality(city: string | null, country: string | null): string {
  const c = (city ?? "").trim();
  const co = (country ?? "").trim();
  if (c && co) return `${c}, ${co}`;
  if (c) return c;
  if (co) return co;
  return "Unknown";
}

export function buildLocalityRanking(rows: WebsiteVisitRow[], limit = 8): LocalityCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = formatLocality(row.city, row.country);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([locality, count]) => ({ locality, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function buildPopularSections(rows: WebsiteVisitRow[], limit = 6): SectionCount[] {
  const total = rows.length || 1;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const section = mapPathToSection(row.page_path);
    counts.set(section, (counts.get(section) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([section, count]) => ({
      section,
      count,
      percent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function buildHighInterestSessions(
  rows: WebsiteVisitRow[],
  minDistinctPages = 4,
  limit = 12
): HighInterestSession[] {
  const bySession = new Map<
    string,
    {
      pages: Set<string>;
      views: number;
      lastSeenAt: string;
      city: string | null;
      country: string | null;
      origin: "direct" | "ref";
      refCode: string | null;
    }
  >();

  for (const row of rows) {
    const existing = bySession.get(row.session_id);
    if (!existing) {
      bySession.set(row.session_id, {
        pages: new Set([row.page_path]),
        views: 1,
        lastSeenAt: row.created_at,
        city: row.city,
        country: row.country,
        origin: row.traffic_origin,
        refCode: row.ref_code,
      });
      continue;
    }
    existing.pages.add(row.page_path);
    existing.views += 1;
    if (new Date(row.created_at).getTime() > new Date(existing.lastSeenAt).getTime()) {
      existing.lastSeenAt = row.created_at;
      existing.city = row.city;
      existing.country = row.country;
      existing.origin = row.traffic_origin;
      existing.refCode = row.ref_code;
    }
  }

  return Array.from(bySession.entries())
    .map(([sessionId, value]) => ({
      sessionId,
      pagesVisited: value.pages.size,
      pageViews: value.views,
      lastSeenAt: value.lastSeenAt,
      locality: formatLocality(value.city, value.country),
      origin: value.origin,
      refCode: value.refCode,
    }))
    .filter((s) => s.pagesVisited >= minDistinctPages)
    .sort((a, b) => {
      if (b.pagesVisited !== a.pagesVisited) return b.pagesVisited - a.pagesVisited;
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    })
    .slice(0, limit);
}

