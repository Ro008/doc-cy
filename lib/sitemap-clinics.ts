import type { SupabaseClient } from "@supabase/supabase-js";
import { clinicLandingPath } from "@/lib/clinic-landing-path";
import { isCyprusDistrict } from "@/lib/cyprus-districts";
import { isDirectoryCanaryClinicId, isDirectoryCanaryClinicSlug } from "@/lib/directory-canaries";
import { isAllSlug, slugToDistrict } from "@/lib/finder-seo";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";

/**
 * Clinic pages in the sitemap (user, 2026-10-16): the Finder no longer searches clinics, but
 * `/clinics` and every clinic page stay public and Google should index them.
 */

export type SitemapClinicRow = {
  id?: string | null;
  slug?: string | null;
  is_archived?: boolean | null;
};

/**
 * The pages `/clinics/{slug}` opens: an unarchived clinic by its current slug (a slug it had
 * before a rename only forwards, so it is not listed). Left out: the canary clinics, and slugs the page
 * reads as something else (a district search, "all") or cannot find (it looks up the
 * slug in lower case).
 */
export function publicClinicSitemapPaths(rows: readonly SitemapClinicRow[]): string[] {
  const slugs = new Set<string>();
  for (const row of rows) {
    if (row.is_archived) continue;
    const slug = String(row.slug ?? "").trim();
    if (!slug || slug !== slug.toLowerCase()) continue;
    if (isDirectoryCanaryClinicId(row.id) || isDirectoryCanaryClinicSlug(slug)) continue;
    if (isAllSlug(slug) || slugToDistrict(slug) || isCyprusDistrict(slug)) continue;
    slugs.add(slug);
  }
  return Array.from(slugs)
    .sort((a, b) => a.localeCompare(b))
    .map((slug) => clinicLandingPath(slug));
}

/** `clinics` has RLS with no policies: pass the service-role client. */
export async function loadPublicClinicSitemapPaths(supabase: SupabaseClient): Promise<string[]> {
  const res = await fetchAllSupabaseRows<SitemapClinicRow>(() =>
    supabase.from("clinics").select("id, slug, is_archived").eq("is_archived", false).order("id"),
  );
  if (res.error) {
    console.error("[DocCy] sitemap clinics failed", res.error);
    return [];
  }
  return publicClinicSitemapPaths(res.data ?? []);
}
