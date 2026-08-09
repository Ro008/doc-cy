import type { SupabaseClient } from "@supabase/supabase-js";
import { isCyprusDistrict, type CyprusDistrict } from "@/lib/cyprus-districts";
import {
  MAX_DOCTOR_SLUG_LENGTH,
  pickFirstAvailableDoctorSlug,
  slugifyDoctorPublicName,
} from "@/lib/doctor-slug";
import { districtToSlug } from "@/lib/finder-seo";

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

  // Prefer base tables (service_role). Public views are revoked from anon.
  const [doctorsRes, manualRes] = await Promise.all([
    supabase.from("doctors").select("slug").not("slug", "is", null).limit(10000),
    supabase
      .from("directory_manual")
      .select("slug")
      .eq("is_archived", false)
      .not("slug", "is", null)
      .limit(10000),
  ]);

  for (const row of doctorsRes.data ?? []) {
    const slug = String((row as { slug?: string | null }).slug ?? "").trim();
    if (slug) taken.add(slug.toLowerCase());
  }

  for (const row of manualRes.data ?? []) {
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
