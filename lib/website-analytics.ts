export type WebsiteVisitRow = {
  session_id: string;
  page_path: string;
  city: string | null;
  country: string | null;
  traffic_origin: "direct" | "ref";
  ref_code: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  user_agent?: string | null;
  is_bot?: boolean;
  created_at: string;
};

export type DoctorQrScanCount = {
  doctorId: string;
  doctorName: string;
  doctorSlug: string;
  scans: number;
};

const LOCALE_SEGMENTS = new Set(["en", "el", "tr"]);

function normalizeUtmToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeRefToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Printed business card QR: ?utm_source=offline&utm_medium=business_card and/or ?ref=business_card */
export function isBusinessCardTaggedVisit(row: WebsiteVisitRow): boolean {
  const src = normalizeUtmToken(row.utm_source);
  const med = normalizeUtmToken(row.utm_medium);
  const ref = normalizeRefToken(row.ref_code);
  const hasBusinessCardUtm = src === "offline" && (med === "business_card" || med === "businesscard");
  const hasBusinessCardRef = ref === "business_card" || ref === "businesscard";
  return hasBusinessCardUtm || hasBusinessCardRef;
}

export function countBusinessCardVisits(rows: WebsiteVisitRow[]): number {
  return rows.filter(isBusinessCardTaggedVisit).length;
}

/** Doctor profile QR: ?utm_source=doctor_qr&utm_medium=profile_card and/or ?ref=doctor_profile_qr */
export function isDoctorProfileQrTaggedVisit(row: WebsiteVisitRow): boolean {
  const src = normalizeUtmToken(row.utm_source);
  const med = normalizeUtmToken(row.utm_medium);
  const ref = normalizeRefToken(row.ref_code);
  const hasDoctorQrUtm = src === "doctor_qr" && med === "profile_card";
  const hasDoctorQrRef = ref === "doctor_profile_qr";
  return hasDoctorQrUtm || hasDoctorQrRef;
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

function extractProfileSlugFromPath(path: string): string | null {
  const parts = String(path)
    .split("/")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2 && LOCALE_SEGMENTS.has(parts[0])) return parts[1];
  return null;
}

export function buildTopDoctorProfileQrScans(
  rows: WebsiteVisitRow[],
  doctors: { id: string; name: string; slug: string | null }[],
  limit = 10
): DoctorQrScanCount[] {
  const doctorsBySlug = new Map<string, { id: string; name: string; slug: string }>();
  for (const d of doctors) {
    const slug = normalizeSlug(d.slug ?? "");
    if (!slug) continue;
    doctorsBySlug.set(slug, {
      id: d.id,
      name: d.name || slug,
      slug,
    });
  }

  const counts = new Map<string, DoctorQrScanCount>();
  for (const row of rows) {
    if (!isDoctorProfileQrTaggedVisit(row)) continue;
    const slug = extractProfileSlugFromPath(row.page_path);
    if (!slug) continue;
    const doctor = doctorsBySlug.get(slug);
    if (!doctor) continue;
    const existing = counts.get(doctor.id);
    if (!existing) {
      counts.set(doctor.id, {
        doctorId: doctor.id,
        doctorName: doctor.name,
        doctorSlug: doctor.slug,
        scans: 1,
      });
      continue;
    }
    existing.scans += 1;
  }

  return Array.from(counts.values())
    .sort((a, b) => {
      if (b.scans !== a.scans) return b.scans - a.scans;
      return a.doctorName.localeCompare(b.doctorName);
    })
    .slice(0, limit);
}

/** Everything else we log: direct URL, search, bookmarks, other UTMs, ?ref=, etc. */
export function countWebsiteAndLinkVisits(rows: WebsiteVisitRow[]): number {
  return rows.filter((r) => !isBusinessCardTaggedVisit(r)).length;
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

/** Vercel geo headers sometimes arrive percent-encoded (e.g. Santa%20Clara). */
function decodeGeoFragment(value: string): string {
  const v = value.trim();
  if (!v) return v;
  try {
    return decodeURIComponent(v.replace(/\+/g, " "));
  } catch {
    return v;
  }
}

export function formatLocality(city: string | null, country: string | null): string {
  const c = decodeGeoFragment(city ?? "");
  const co = decodeGeoFragment(country ?? "");
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

