import type { SupabaseClient } from "@supabase/supabase-js";
import { isCyprusDistrict, type CyprusDistrict } from "@/lib/cyprus-districts";
import {
  MAX_DOCTOR_SLUG_LENGTH,
  pickFirstAvailableDoctorSlug,
  slugifyDoctorPublicName,
} from "@/lib/doctor-slug";
import { districtToSlug } from "@/lib/finder-seo";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";

function trimSlug(value: string): string {
  return value.slice(0, MAX_DOCTOR_SLUG_LENGTH).replace(/-+$/g, "");
}

function manualRowIdSuffix(manualId: string): string {
  return manualId.replace(/-/g, "").slice(0, 8);
}

/** Candidate slugs for a manual directory row (mirrors registered doctor slug rules). */
export function buildManualDirectorySlugCandidates(input: {
  name: string;
  district?: string | null;
  manualId?: string;
}): string[] {
  const nameSlug = slugifyDoctorPublicName(input.name);
  const base = nameSlug || "professional";
  const candidates: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    const normalized = trimSlug(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) return;
    seen.add(key);
    candidates.push(normalized);
  };

  push(base);

  if (input.district && isCyprusDistrict(input.district)) {
    push(`${base}-${districtToSlug(input.district as CyprusDistrict)}`);
  }

  for (let suffix = 2; suffix <= 200; suffix += 1) {
    push(`${base}-${suffix}`);
  }

  if (input.manualId) {
    push(`${base}-${manualRowIdSuffix(input.manualId)}`);
  }

  return candidates;
}

export async function loadTakenPublicSlugs(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const taken = new Set<string>();

  // Unified slug namespace on professionals.
  const professionalsRes = await fetchAllSupabaseRows(() =>
    supabase.from("professionals").select("slug").not("slug", "is", null),
  );

  for (const row of professionalsRes.data ?? []) {
    const slug = String((row as { slug?: string | null }).slug ?? "").trim();
    if (slug) taken.add(slug.toLowerCase());
  }

  return taken;
}

export function allocateManualDirectorySlug(
  takenLowercase: ReadonlySet<string>,
  input: { name: string; district?: string | null; manualId?: string },
): string | null {
  const candidates = buildManualDirectorySlugCandidates(input);
  return pickFirstAvailableDoctorSlug(takenLowercase, candidates);
}

export type ManualDirectorySlugAliasRow = {
  slug?: string | null;
  name?: string | null;
  finder_visible?: boolean | null;
};

/**
 * Map a retired name-only slug (e.g. Google still showing `/vera-politou`)
 * to the current unique slug (`vera-politou-paphos`).
 *
 * Returns a target only when exactly one visible professional's name slugifies
 * to the requested slug. Two people named Vera Politou keep distinct URLs and
 * must not share a redirect.
 */
export function pickUniqueLegacyNameSlugAlias(
  requestedSlug: string,
  rows: readonly ManualDirectorySlugAliasRow[],
): string | null {
  const requested = String(requestedSlug ?? "").trim().toLowerCase();
  if (!requested) return null;

  const matches = new Set<string>();
  const visible = new Set<string>();
  for (const row of rows) {
    const current = String(row.slug ?? "").trim().toLowerCase();
    if (!current || current === requested) continue;
    if (slugifyDoctorPublicName(String(row.name ?? "")) !== requested) continue;
    matches.add(current);
    if (row.finder_visible !== false) visible.add(current);
  }

  if (matches.size !== 1) return null;
  const canonical = Array.from(matches)[0] ?? null;
  if (!canonical || !visible.has(canonical)) return null;
  return canonical;
}

export async function allocateUniqueManualDirectorySlug(
  supabase: SupabaseClient,
  input: { name: string; district?: string | null; manualId?: string },
  extraTakenLowercase: ReadonlySet<string> = new Set(),
): Promise<string> {
  const taken = await loadTakenPublicSlugs(supabase);
  for (const slug of Array.from(extraTakenLowercase)) {
    taken.add(slug.toLowerCase());
  }

  const slug = allocateManualDirectorySlug(taken, input);
  if (!slug) {
    throw new Error(`Could not allocate manual directory slug for "${input.name}"`);
  }
  return slug;
}
