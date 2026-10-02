import type { MetadataRoute } from "next";
import { CYPRUS_DISTRICTS, isCyprusDistrict, type CyprusDistrict } from "@/lib/cyprus-districts";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { districtToSlug, slugToDistrict } from "@/lib/finder-seo";
import { getAllBlogPostMeta } from "@/lib/blog";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { canonicalFinderSpecialtyRedirectPath } from "@/lib/finder-public-path";
import { isDirectoryCanarySlug } from "@/lib/directory-canaries";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";
import { loadDoctorLocationsByDoctorIds } from "@/lib/load-doctor-locations";
import { clinicDistricts } from "@/lib/professional-clinic-locations";
import { LISTING_CLINICS_SELECT, listingClinicLocations } from "@/lib/listing-clinic-location";

function normalizeDistrictSlug(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (isCyprusDistrict(raw)) return districtToSlug(raw as CyprusDistrict);
  const fromSlug = slugToDistrict(raw.toLowerCase());
  return fromSlug ? districtToSlug(fromSlug) : "";
}

type SpecialtyPairRow = {
  specialties?: { slug?: string | null } | null;
  professionals?: {
    id?: string | null;
    is_test_profile?: boolean | null;
    name?: string | null;
    listing_clinics?: unknown;
  } | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const siteBase = siteUrl.replace(/\/+$/, "");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${siteBase}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${siteBase}/for-professionals`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteBase}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteBase}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const supabase = createServiceRoleClient();
  if (!supabase) return staticEntries;

  // One URL per district x specialty with at least one professional the finder
  // shows: registered professionals, and active scraped listings. Every
  // specialty counts, not only the first (professional_specialties).
  const loadPairs = (registered: boolean) =>
    fetchAllSupabaseRows(() => {
      let q = supabase
        .from("professional_specialties")
        .select(
          `specialties!inner(slug), professionals!inner(id, is_test_profile, name, is_archived, is_registered, slug${registered ? "" : `, ${LISTING_CLINICS_SELECT}`})`,
        )
        .eq("is_approved", true)
        .eq("professionals.is_archived", false)
        .eq("professionals.is_registered", registered);
      if (registered) {
        q = q.not("professionals.slug", "is", null);
      }
      return q.order("id");
    });
  const [registeredPairs, scrapedPairs] = await Promise.all([loadPairs(true), loadPairs(false)]);
  // Every professional counts in each district their clinics are in (Point E5).
  const registeredIds = ((registeredPairs.data ?? []) as SpecialtyPairRow[])
    .map((row) => String(row.professionals?.id ?? "").trim())
    .filter(Boolean);
  const registeredLocations = await loadDoctorLocationsByDoctorIds(registeredIds);

  const pairSet = new Set<string>();
  const addPairs = (res: { data: unknown[] | null; error: unknown }, registered: boolean) => {
    if (res.error) {
      console.error("[DocCy] sitemap specialty pairs failed", res.error);
      return;
    }
    for (const row of (res.data ?? []) as SpecialtyPairRow[]) {
      const pro = row.professionals;
      if (registered && (pro?.is_test_profile || /\btest\b/i.test(String(pro?.name ?? "")))) {
        continue;
      }
      const specialtySlug = String(row.specialties?.slug ?? "").trim();
      if (!specialtySlug) continue;
      const districts = registered
        ? clinicDistricts(registeredLocations.get(String(pro?.id ?? "")) ?? [])
        : clinicDistricts(listingClinicLocations(pro ?? {}));
      for (const district of districts) {
        const districtSlug = normalizeDistrictSlug(district);
        if (!districtSlug) continue;
        // A legacy-spelling catalogue row 308s to its canonical URL; list that one.
        const redirect = canonicalFinderSpecialtyRedirectPath(`/${districtSlug}/${specialtySlug}`);
        pairSet.add(
          redirect ? redirect.slice(1).replace("/", "::") : `${districtSlug}::${specialtySlug}`,
        );
      }
    }
  };
  addPairs(registeredPairs, true);
  addPairs(scrapedPairs, false);

  // Ensure district-only URLs also exist for each district that currently has content.
  const districtSet = new Set<string>();
  for (const pair of Array.from(pairSet)) {
    districtSet.add(pair.split("::")[0]);
  }
  // Keep canonical Cyprus district slugs constrained to expected english set.
  for (const district of CYPRUS_DISTRICTS) {
    const districtSlug = districtToSlug(district);
    if (districtSet.has(districtSlug)) {
      staticEntries.push({
        url: `${siteBase}/${districtSlug}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  }

  const dynamicFinderEntries: MetadataRoute.Sitemap = Array.from(pairSet)
    .sort((a, b) => a.localeCompare(b))
    .map((pair) => {
      const [districtSlug, specialtySlug] = pair.split("::");
      return {
        url: `${siteBase}/${districtSlug}/${specialtySlug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.8,
      };
    });

  const blogPosts = await getAllBlogPostMeta();
  const blogEntries: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${siteBase}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt || post.publishedAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  let manualDoctorEntries: MetadataRoute.Sitemap = [];
  type ManualSitemapSlugRow = {
    slug?: string | null;
    is_test_profile?: boolean | null;
    is_registered?: boolean | null;
    name?: string | null;
  };
  const manualSlugRes: {
    data: ManualSitemapSlugRow[] | null;
    error: { code?: string; message?: string } | null;
  } = await fetchAllSupabaseRows(() =>
    supabase
      .from("professionals")
      .select("slug, is_test_profile, is_registered, name")
      .eq("is_archived", false)
      .not("slug", "is", null),
  );

  const slugColumnMissing =
    manualSlugRes.error &&
    String(manualSlugRes.error.message ?? "").toLowerCase().includes("slug");

  const manualSlugRows = slugColumnMissing ? [] : (manualSlugRes.data ?? []);

  if (!manualSlugRes.error || slugColumnMissing) {
    if (manualSlugRows.length > 0) {
      manualDoctorEntries = manualSlugRows
      .map((row) => {
        const slug = String(row.slug ?? "").trim();
        if (!slug || isDirectoryCanarySlug(slug)) return null;
        if (row.is_test_profile) return null;
        if (/\btest\b/i.test(String(row.name ?? ""))) return null;
        return {
          url: `${siteBase}${publicProfessionalProfilePath(slug)}`,
          lastModified: now,
          changeFrequency: "monthly" as const,
          priority: 0.6,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.url.localeCompare(b.url));
    }
  }

  return [...staticEntries, ...dynamicFinderEntries, ...manualDoctorEntries, ...blogEntries];
}
