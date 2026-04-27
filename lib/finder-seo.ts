import type { CyprusDistrict } from "@/lib/cyprus-districts";

const DISTRICT_SLUG_TO_LABEL: Record<string, CyprusDistrict> = {
  nicosia: "Nicosia",
  limassol: "Limassol",
  paphos: "Paphos",
  larnaca: "Larnaca",
  famagusta: "Famagusta",
};

const DISTRICT_LABEL_TO_SLUG = Object.fromEntries(
  Object.entries(DISTRICT_SLUG_TO_LABEL).map(([slug, label]) => [label, slug])
) as Record<CyprusDistrict, string>;

export function districtToSlug(district: CyprusDistrict): string {
  return DISTRICT_LABEL_TO_SLUG[district];
}

export function slugToDistrict(slug: string): CyprusDistrict | null {
  return DISTRICT_SLUG_TO_LABEL[String(slug || "").trim().toLowerCase()] ?? null;
}

export function specialtyToSlug(value: string): string {
  const normalized = String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "all";
}

export function slugToSpecialty(slug: string): string {
  return String(slug || "")
    .replace(/-/g, " ")
    .trim();
}

export function isAllSlug(value: string | undefined | null): boolean {
  return String(value ?? "").trim().toLowerCase() === "all";
}

export function toTitleCaseWords(value: string): string {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

