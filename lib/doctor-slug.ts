import type { SupabaseClient } from "@supabase/supabase-js";
import { isCyprusDistrict, type CyprusDistrict } from "@/lib/cyprus-districts";
import { districtToSlug } from "@/lib/finder-seo";

export const MAX_DOCTOR_SLUG_LENGTH = 60;

export function slugifyDoctorPublicName(name: string): string {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_DOCTOR_SLUG_LENGTH);
}

function trimSlug(value: string): string {
  return value.slice(0, MAX_DOCTOR_SLUG_LENGTH).replace(/-+$/g, "");
}

function authUserSlugSuffix(authUserId: string): string {
  return authUserId.replace(/-/g, "").slice(0, 8);
}

export function buildDoctorSlugCandidates(input: {
  name: string;
  district?: string | null;
  authUserId: string;
}): string[] {
  const nameSlug = slugifyDoctorPublicName(input.name);
  const base =
    nameSlug || `doctor-${authUserSlugSuffix(input.authUserId)}`;
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

  push(`${base}-${authUserSlugSuffix(input.authUserId)}`);
  return candidates;
}

export function pickFirstAvailableDoctorSlug(
  takenLowercase: ReadonlySet<string>,
  candidates: string[],
): string | null {
  for (const candidate of candidates) {
    if (!takenLowercase.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return null;
}

export async function allocateUniqueDoctorSlug(
  supabase: SupabaseClient,
  input: { name: string; district?: string | null; authUserId: string },
): Promise<string> {
  const candidates = buildDoctorSlugCandidates(input);
  const { data, error } = await supabase
    .from("professionals")
    .select("slug")
    .in("slug", candidates);

  if (error) {
    console.error("[DocCy] doctor slug availability lookup failed:", error);
    return candidates[candidates.length - 1] ?? `doctor-${authUserSlugSuffix(input.authUserId)}`;
  }

  const taken = new Set(
    (data ?? [])
      .map((row) => String((row as { slug?: string | null }).slug ?? "").trim().toLowerCase())
      .filter(Boolean),
  );

  return (
    pickFirstAvailableDoctorSlug(taken, candidates) ??
    candidates[candidates.length - 1] ??
    `doctor-${authUserSlugSuffix(input.authUserId)}`
  );
}

function slugMatchesNameCandidates(
  currentSlug: string,
  candidates: string[],
): boolean {
  const normalized = currentSlug.trim().toLowerCase();
  if (!normalized) return false;
  return candidates.some((candidate) => candidate.toLowerCase() === normalized);
}

/**
 * When a founder verifies a registration whose name changed, realign the public slug.
 * Returns the new slug when updated, or null when unchanged.
 */
export async function realignDoctorSlugIfNameChanged(
  supabase: SupabaseClient,
  input: {
    doctorId: string;
    name: string;
    district?: string | null;
    authUserId: string;
    currentSlug?: string | null;
  },
): Promise<string | null> {
  const currentSlug = String(input.currentSlug ?? "").trim();
  const candidates = buildDoctorSlugCandidates({
    name: input.name,
    district: input.district,
    authUserId: input.authUserId,
  });

  if (currentSlug && slugMatchesNameCandidates(currentSlug, candidates)) {
    return null;
  }

  const { data, error } = await supabase
    .from("professionals")
    .select("slug")
    .in("slug", candidates);

  if (error) {
    console.error("[DocCy] doctor slug realign lookup failed:", error);
    return null;
  }

  const taken = new Set(
    (data ?? [])
      .map((row) => String((row as { slug?: string | null }).slug ?? "").trim().toLowerCase())
      .filter(Boolean),
  );

  if (currentSlug) {
    taken.delete(currentSlug.toLowerCase());
  }

  const nextSlug =
    pickFirstAvailableDoctorSlug(taken, candidates) ??
    candidates[candidates.length - 1] ??
    null;

  if (!nextSlug || nextSlug.toLowerCase() === currentSlug.toLowerCase()) {
    return null;
  }

  const { error: updateError } = await supabase
    .from("professionals")
    .update({ slug: nextSlug })
    .eq("id", input.doctorId);

  if (updateError) {
    console.error("[DocCy] doctor slug realign update failed:", updateError);
    return null;
  }

  return nextSlug;
}
