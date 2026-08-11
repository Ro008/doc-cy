/**
 * Finder specialty label harmonization.
 *
 * GeSY manual labels are preferred. Legacy registration spellings bridge into GeSY
 * so filters stay unified — except `Psychology`, which is a deliberate DocCy label
 * distinct from GeSY `Clinical Psychologist` (do not merge).
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
  // Psychology is a DocCy registration specialty — do NOT map to Clinical Psychologist.
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
  oncology: "Medical Oncology",
  hematology: "Haematology",
};

const GESY_BY_SLUG = new Map(
  GESY_MANUAL_SPECIALTIES.map((label) => [specialtyToSlug(label), label]),
);
// DocCy exception also resolves by slug for finder URLs.
GESY_BY_SLUG.set(specialtyToSlug("Psychology"), "Psychology");

/** Resolve slug-decoded / casing variants to the canonical GeSY (or DocCy) label. */
function resolveGesyLabelBySlug(raw: string): string | null {
  const slug = specialtyToSlug(raw);
  if (!slug || slug === "all") return null;
  return GESY_BY_SLUG.get(slug) ?? null;
}

export function harmonizeFinderSpecialtyLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const key = specialtyMatchKey(trimmed);
  if (key === "psychology") return "Psychology";
  if (LEGACY_TO_GESY[key]) return LEGACY_TO_GESY[key];
  const bySlug = resolveGesyLabelBySlug(trimmed);
  if (bySlug) return bySlug;
  return trimmed;
}
