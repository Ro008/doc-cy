/**
 * Internal canary (honeytoken) listings for anti-scraping / legal proof.
 *
 * These rows are intentionally present in the public finder so a bulk scrape
 * copies them. They are excluded from the sitemap to limit organic discovery.
 *
 * If a competing directory later shows the same phone + name + maps fingerprint,
 * that is strong evidence of unauthorized extraction (see Terms §5 liquidated damages).
 *
 * Do not delete these without updating this registry and the SQL migration.
 */

export type DirectoryCanary = {
  id: string;
  slug: string;
  name: string;
  specialty: string;
  district: "Famagusta" | "Larnaca";
  phone: string;
  /** Unique Maps URL fingerprint (not a real clinic). */
  addressMapsLink: string;
  latitude: number;
  longitude: number;
};

/** Reserved phone block: +357 99 041 801 … 806 */
export const DIRECTORY_CANARIES: readonly DirectoryCanary[] = [
  {
    id: "c0418010-d0cc-4a01-8001-cafebabe0001",
    slug: "melina-orphanidou-famagusta",
    name: "Melina Orphanidou",
    specialty: "Nutrition & Dietetics",
    district: "Famagusta",
    phone: "+35799041801",
    addressMapsLink:
      "https://maps.google.com/?cid=9048173620148202601&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
    latitude: 35.12641,
    longitude: 33.94371,
  },
  {
    id: "c0418020-d0cc-4a01-8002-cafebabe0002",
    slug: "stavros-pelides-famagusta",
    name: "Stavros Pelides",
    specialty: "ENT",
    district: "Famagusta",
    phone: "+35799041802",
    addressMapsLink:
      "https://maps.google.com/?cid=9048173620148202602&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
    latitude: 35.12711,
    longitude: 33.94421,
  },
  {
    id: "c0418030-d0cc-4a01-8003-cafebabe0003",
    slug: "ioanna-meletiou-larnaca",
    name: "Ioanna Meletiou",
    specialty: "Rheumatology",
    district: "Larnaca",
    phone: "+35799041803",
    addressMapsLink:
      "https://maps.google.com/?cid=9048173620148202603&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
    latitude: 34.92211,
    longitude: 33.62341,
  },
  {
    id: "c0418040-d0cc-4a01-8004-cafebabe0004",
    slug: "kyriakos-demetriades-famagusta",
    name: "Kyriakos Demetriades",
    specialty: "Pulmonology",
    district: "Famagusta",
    phone: "+35799041804",
    addressMapsLink:
      "https://maps.google.com/?cid=9048173620148202604&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
    latitude: 35.12801,
    longitude: 33.94501,
  },
  {
    id: "c0418050-d0cc-4a01-8005-cafebabe0005",
    slug: "marilena-sofocleous-larnaca",
    name: "Marilena Sofocleous",
    specialty: "Nephrology",
    district: "Larnaca",
    phone: "+35799041805",
    addressMapsLink:
      "https://maps.google.com/?cid=9048173620148202605&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
    latitude: 34.92301,
    longitude: 33.62411,
  },
  {
    id: "c0418060-d0cc-4a01-8006-cafebabe0006",
    slug: "petros-athanasiades-famagusta",
    name: "Petros Athanasiades",
    specialty: "Gastroenterology",
    district: "Famagusta",
    phone: "+35799041806",
    addressMapsLink:
      "https://maps.google.com/?cid=9048173620148202606&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
    latitude: 35.12881,
    longitude: 33.94581,
  },
] as const;

const canarySlugSet = new Set(
  DIRECTORY_CANARIES.map((row) => row.slug.toLowerCase()),
);
const canaryPhoneSet = new Set(
  DIRECTORY_CANARIES.map((row) => row.phone.replace(/\s+/g, "")),
);
const canaryIdSet = new Set(DIRECTORY_CANARIES.map((row) => row.id));

export function isDirectoryCanarySlug(slug: string | null | undefined): boolean {
  const normalized = String(slug ?? "")
    .trim()
    .toLowerCase();
  return Boolean(normalized) && canarySlugSet.has(normalized);
}

export function isDirectoryCanaryPhone(phone: string | null | undefined): boolean {
  const normalized = String(phone ?? "").replace(/\s+/g, "").trim();
  return Boolean(normalized) && canaryPhoneSet.has(normalized);
}

export function isDirectoryCanaryId(id: string | null | undefined): boolean {
  const normalized = String(id ?? "").trim().toLowerCase();
  return Boolean(normalized) && canaryIdSet.has(normalized);
}
