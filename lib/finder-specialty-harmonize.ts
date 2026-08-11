/**
 * Finder-only canonical labels for directory cards.
 *
 * Decoupled from registration master list (`lib/cyprus-specialties.ts`).
 * GeSY manual specialties are the preferred finder labels; older registered-doctor
 * labels are bridged into GeSY equivalents so filters stay unified.
 *
 * URL segments arrive as slug-decoded lowercase (e.g. "personal doctor"); we
 * resolve those back to canonical GeSY labels so SQL `overlaps` matches.
 */
import { specialtyToSlug } from "@/lib/finder-seo";
import { GESY_MANUAL_SPECIALTIES } from "@/lib/gesy-specialties";

function specialtyMatchKey(raw: string): string {
  return raw
    .normalize("NFKD")
    // BMP combining marks (avoid `\p{M}` — breaks `next build` / TS target on Vercel).
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim();
}

/** Old registration / legacy labels → GeSY manual directory labels. */
const LEGACY_TO_GESY: Record<string, string> = {
  dentistry: "Dentist",
  "pediatric dentistry": "Dentist",
  "cosmetic dentistry": "Dentist",
  dental: "Dentist",
  pediatrics: "Paediatrics",
  paediatric: "Paediatrics",
  gynecology: "Obstetrics - Gynaecology",
  "gynecologic oncology": "Obstetrics - Gynaecology",
  "obstetrics/gynecology": "Obstetrics - Gynaecology",
  "obstetrics / gynecology": "Obstetrics - Gynaecology",
  "obstetrics and gynecology": "Obstetrics - Gynaecology",
  "physiotherapy & rehabilitation": "Physiotherapist",
  physiotherapy: "Physiotherapist",
  psychology: "Clinical Psychologist",
  psychotherapy: "Clinical Psychologist",
  dermatology: "Dermato-Venereology",
  orthopedics: "Orthopaedics",
  orthopaedics: "Orthopaedics",
  ent: "Otorhinolaryngology",
  pulmonology: "Respiratory Medicine",
  nephrology: "Renal Diseases",
  "nutrition & dietetics": "Clinical Dietitian",
  "general practice": "Personal Doctor",
  "laser & medical aesthetics": "Plastic Surgery",
  wellness: "Personal Doctor",
};

const GESY_BY_SLUG = new Map(
  GESY_MANUAL_SPECIALTIES.map((label) => [specialtyToSlug(label), label]),
);

/** Resolve slug-decoded / casing variants to the canonical GeSY label. */
function resolveGesyLabelBySlug(raw: string): string | null {
  const slug = specialtyToSlug(raw);
  if (!slug || slug === "all") return null;
  return GESY_BY_SLUG.get(slug) ?? null;
}

export function harmonizeFinderSpecialtyLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const key = specialtyMatchKey(trimmed);
  if (LEGACY_TO_GESY[key]) return LEGACY_TO_GESY[key];
  const bySlug = resolveGesyLabelBySlug(trimmed);
  if (bySlug) return bySlug;
  return trimmed;
}
