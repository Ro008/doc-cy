/**
 * DocCy clinic search on /register: match every word against the clinic name,
 * address and town (names are romanised Greek, and many practices are listed
 * under a person's name, so the street is often what the doctor knows).
 */

export const REGISTER_CLINIC_SEARCH_MIN_QUERY = 2;
export const REGISTER_CLINIC_SEARCH_LIMIT = 8;

/** Public fields only: the same data the /clinics directory already shows. */
export type ClinicSearchCandidate = {
  id: string;
  name: string;
  address: string;
  town: string | null;
  district: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  professionalCount: number;
};

export function normalizeClinicSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function clinicSearchTokens(query: string): string[] {
  const normalized = normalizeClinicSearchText(query);
  if (normalized.replace(/\s/g, "").length < REGISTER_CLINIC_SEARCH_MIN_QUERY) return [];
  return normalized.split(" ").filter(Boolean);
}

function nameScore(name: string, query: string, firstToken: string): number {
  if (name.startsWith(query)) return 3;
  if (name.split(" ").some((word) => word.startsWith(firstToken))) return 2;
  return 1;
}

export function rankClinicSearchResults(
  candidates: readonly ClinicSearchCandidate[],
  query: string,
  limit = REGISTER_CLINIC_SEARCH_LIMIT,
): ClinicSearchCandidate[] {
  const tokens = clinicSearchTokens(query);
  if (tokens.length === 0) return [];
  const normalizedQuery = tokens.join(" ");

  return candidates
    .map((candidate) => {
      const name = normalizeClinicSearchText(candidate.name);
      const haystack = `${name} ${normalizeClinicSearchText(candidate.address)} ${normalizeClinicSearchText(
        candidate.town ?? "",
      )}`;
      if (!tokens.every((token) => haystack.includes(token))) return null;
      return { candidate, score: nameScore(name, normalizedQuery, tokens[0]!) };
    })
    .filter((entry): entry is { candidate: ClinicSearchCandidate; score: number } => entry !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.candidate.professionalCount - a.candidate.professionalCount ||
        a.candidate.name.localeCompare(b.candidate.name),
    )
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
