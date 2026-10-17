import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import type { FinderSpecialtyOption } from "@/lib/finder-specialty-options";

/**
 * The Finder's one "Specialty or name" field (mockup R3; user, 2026-10-16): the Filters
 * panel went, and its name search joined the specialty in the header.
 */

export type FinderWhoSubmit =
  | { kind: "all" }
  | { kind: "specialty"; slug: string }
  | { kind: "name"; name: string };

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Search pressed without picking a suggestion: a specialty's exact name (or slug) runs a
 * specialty search; anything else looks for professionals by name.
 */
export function resolveFinderWhoSubmit(
  text: string,
  options: readonly FinderSpecialtyOption[],
): FinderWhoSubmit {
  const value = collapse(String(text ?? ""));
  if (!value) return { kind: "all" };
  const lower = value.toLowerCase();
  const match = options.find(
    (option) => option.label.toLowerCase() === lower || option.slug.toLowerCase() === lower,
  );
  return match ? { kind: "specialty", slug: match.slug } : { kind: "name", name: value };
}

/** The label around the typed text, so the suggestion can show it in bold. */
export function splitFinderMatch(
  label: string,
  query: string,
): { before: string; hit: string; after: string } {
  const q = String(query ?? "").trim();
  const at = q ? label.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return { before: label, hit: "", after: "" };
  return { before: label.slice(0, at), hit: label.slice(at, at + q.length), after: label.slice(at + q.length) };
}

const TITLES = new Set(["dr", "dr.", "prof", "prof.", "mr", "mr.", "mrs", "mrs.", "ms", "ms."]);

/** First and last initials ("Dr. Andreas Nikos Petrou" → "AP"), for a suggestion without a photo. */
export function finderNameInitials(name: string): string {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter((word) => word && !TITLES.has(word.toLowerCase()));
  if (words.length === 0) return "";
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

export const FINDER_NAME_MIN_QUERY_LENGTH = 2;
const FINDER_NAME_MAX_QUERY_LENGTH = 60;
export const FINDER_NAME_SUGGESTION_LIMIT = 5;

/** What the name lookup searches for; "" = too short to ask. */
export function normalizeFinderNameQuery(raw: unknown): string {
  const value = collapse(String(raw ?? "")).slice(0, FINDER_NAME_MAX_QUERY_LENGTH);
  return value.length >= FINDER_NAME_MIN_QUERY_LENGTH ? value : "";
}

export type FinderNameSuggestionRow = {
  id: string;
  name: string;
  slug: string | null;
  isRegistered: boolean;
  /** Her own photo; null for a default avatar (listings never have one). */
  ownPhotoUrl: string | null;
  specialty: string | null;
  district: string | null;
};

export type FinderNameSuggestion = {
  id: string;
  name: string;
  href: string;
  photoUrl: string | null;
  initials: string;
  /** "Paediatrician · Paphos", or what of it is known. */
  meta: string;
};

/** Registered professionals first, then by name; five at most; only those with a page. */
export function shapeFinderNameSuggestions(
  rows: readonly FinderNameSuggestionRow[],
): FinderNameSuggestion[] {
  return rows
    .filter((row) => String(row.slug ?? "").trim())
    .slice()
    .sort(
      (a, b) =>
        Number(b.isRegistered) - Number(a.isRegistered) ||
        a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    )
    .slice(0, FINDER_NAME_SUGGESTION_LIMIT)
    .map((row) => ({
      id: row.id,
      name: row.name,
      href: publicProfessionalProfilePath(String(row.slug)),
      photoUrl: row.isRegistered ? row.ownPhotoUrl : null,
      initials: finderNameInitials(row.name),
      meta: [row.specialty, row.district].filter((part) => String(part ?? "").trim()).join(" · "),
    }));
}
