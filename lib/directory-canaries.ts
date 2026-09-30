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
  /** The canary's own fake clinic, so its phone button still shows (see migration). */
  clinicId: string;
  clinicSlug: string;
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
    clinicId: "c0418011-d0cc-4a01-9001-cafebabe1001",
    slug: "melina-orphanidou-famagusta",
    clinicSlug: "melina-orphanidou-famagusta-clinic",
    name: "Melina Orphanidou",
    specialty: "Clinical Dietitian",
    district: "Famagusta",
    phone: "+35799041801",
    addressMapsLink:
      "https://maps.google.com/?cid=9048173620148202601&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
    latitude: 35.12641,
    longitude: 33.94371,
  },
  {
    id: "c0418020-d0cc-4a01-8002-cafebabe0002",
    clinicId: "c0418012-d0cc-4a01-9002-cafebabe1002",
    slug: "stavros-pelides-famagusta",
    clinicSlug: "stavros-pelides-famagusta-clinic",
    name: "Stavros Pelides",
    specialty: "Otorhinolaryngology",
    district: "Famagusta",
    phone: "+35799041802",
    addressMapsLink:
      "https://maps.google.com/?cid=9048173620148202602&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
    latitude: 35.12711,
    longitude: 33.94421,
  },
  {
    id: "c0418030-d0cc-4a01-8003-cafebabe0003",
    clinicId: "c0418013-d0cc-4a01-9003-cafebabe1003",
    slug: "ioanna-meletiou-larnaca",
    clinicSlug: "ioanna-meletiou-larnaca-clinic",
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
    clinicId: "c0418014-d0cc-4a01-9004-cafebabe1004",
    slug: "kyriakos-demetriades-famagusta",
    clinicSlug: "kyriakos-demetriades-famagusta-clinic",
    name: "Kyriakos Demetriades",
    specialty: "Respiratory Medicine",
    district: "Famagusta",
    phone: "+35799041804",
    addressMapsLink:
      "https://maps.google.com/?cid=9048173620148202604&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
    latitude: 35.12801,
    longitude: 33.94501,
  },
  {
    id: "c0418050-d0cc-4a01-8005-cafebabe0005",
    clinicId: "c0418015-d0cc-4a01-9005-cafebabe1005",
    slug: "marilena-sofocleous-larnaca",
    clinicSlug: "marilena-sofocleous-larnaca-clinic",
    name: "Marilena Sofocleous",
    specialty: "Renal Diseases",
    district: "Larnaca",
    phone: "+35799041805",
    addressMapsLink:
      "https://maps.google.com/?cid=9048173620148202605&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
    latitude: 34.92301,
    longitude: 33.62411,
  },
  {
    id: "c0418060-d0cc-4a01-8006-cafebabe0006",
    clinicId: "c0418016-d0cc-4a01-9006-cafebabe1006",
    slug: "petros-athanasiades-famagusta",
    clinicSlug: "petros-athanasiades-famagusta-clinic",
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
const canaryClinicIdSet = new Set(DIRECTORY_CANARIES.map((row) => row.clinicId));
const canaryClinicSlugSet = new Set(
  DIRECTORY_CANARIES.map((row) => row.clinicSlug.toLowerCase()),
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

export function isDirectoryCanaryClinicId(id: string | null | undefined): boolean {
  const normalized = String(id ?? "").trim().toLowerCase();
  return Boolean(normalized) && canaryClinicIdSet.has(normalized);
}

export function isDirectoryCanaryClinicSlug(slug: string | null | undefined): boolean {
  const normalized = String(slug ?? "")
    .trim()
    .toLowerCase();
  return Boolean(normalized) && canaryClinicSlugSet.has(normalized);
}

/** Canary clinics are bait for scrapers, never something an applicant may pick. */
export function withoutDirectoryCanaryClinics<T extends { id: string }>(
  clinics: readonly T[],
): T[] {
  return clinics.filter((clinic) => !isDirectoryCanaryClinicId(clinic.id));
}
