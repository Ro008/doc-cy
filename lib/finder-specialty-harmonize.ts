/**
 * Finder-only canonical labels for directory cards (decoupled from registration master list).
 * Used for dropdown grouping and filter matching.
 */
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

const GYNECOLOGY_GROUP = new Set([
  "gynecologic oncology",
  "gynecology",
  "obstetrics/gynecology",
]);

const PHYSIOTHERAPY_GROUP = new Set(["physiotherapy", "physiotherapy & rehabilitation"]);

const PSYCHOLOGY_GROUP = new Set(["psychology", "psychotherapy"]);

const DENTISTRY_GROUP = new Set([
  "dentistry",
  "pediatric dentistry",
  "cosmetic dentistry",
  "orthodontics",
  "endodontics",
  "oral surgery",
]);

export function harmonizeFinderSpecialtyLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const key = specialtyMatchKey(trimmed);
  if (GYNECOLOGY_GROUP.has(key)) return "Gynecology";
  if (PHYSIOTHERAPY_GROUP.has(key)) return "Physiotherapy & Rehabilitation";
  if (PSYCHOLOGY_GROUP.has(key)) return "Psychology";
  if (DENTISTRY_GROUP.has(key)) return "Dentistry";
  return trimmed;
}
