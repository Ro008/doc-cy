import type { MetadataRoute } from "next";
import { CYPRUS_DISTRICTS, isCyprusDistrict, type CyprusDistrict } from "@/lib/cyprus-districts";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { districtToSlug, specialtyToSlug, slugToDistrict } from "@/lib/finder-seo";
import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";
import { getAllBlogPostMeta } from "@/lib/blog";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { isDirectoryCanarySlug } from "@/lib/directory-canaries";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";

function normalizeDistrictSlug(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (isCyprusDistrict(raw)) return districtToSlug(raw as CyprusDistrict);
  const fromSlug = slugToDistrict(raw.toLowerCase());
  return fromSlug ? districtToSlug(fromSlug) : "";
}

function normalizeSpecialtySlug(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return specialtyToSlug(harmonizeFinderSpecialtyLabel(raw) || raw);
}

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

  // All listed professionals (registered + directory) live in `professionals`.
  const [doctorsRes, profilesRes, manualRes] = await Promise.all([
    fetchAllSupabaseRows(() =>
      supabase
        .from("professionals")
        .select("district, specialty, is_test_profile, name")
        .eq("status", "verified")
        .eq("is_registered", true)
        .not("slug", "is", null),
    ),
    fetchAllSupabaseRows(() =>
      supabase.from("profiles").select("district, specialty").eq("status", "verified"),
    ),
    fetchAllSupabaseRows(() =>
      supabase
        .from("professionals")
        .select("district, specialty")
        .eq("is_archived", false)
        .eq("is_registered", false),
    ),
  ]);

  const pairSet = new Set<string>();

  const doctorRows = !doctorsRes.error ? doctorsRes.data ?? [] : [];
  for (const row of doctorRows) {
    const isExplicitTest = Boolean(
      (row as { is_test_profile?: boolean | null }).is_test_profile
    );
    const isNameTest = /\btest\b/i.test(String((row as { name?: string }).name ?? ""));
    if (isExplicitTest || isNameTest) continue;

    const districtSlug = normalizeDistrictSlug((row as { district?: unknown }).district);
    const specialtySlug = normalizeSpecialtySlug((row as { specialty?: unknown }).specialty);
    if (!districtSlug || !specialtySlug || specialtySlug === "all") continue;
    pairSet.add(`${districtSlug}::${specialtySlug}`);
  }

  const profileRows = !profilesRes.error ? profilesRes.data ?? [] : [];
  for (const row of profileRows) {
    const districtSlug = normalizeDistrictSlug((row as { district?: unknown }).district);
    const specialtySlug = normalizeSpecialtySlug((row as { specialty?: unknown }).specialty);
    if (!districtSlug || !specialtySlug || specialtySlug === "all") continue;
    pairSet.add(`${districtSlug}::${specialtySlug}`);
  }

  const manualRows = !manualRes.error ? manualRes.data ?? [] : [];
  for (const row of manualRows) {
    const districtSlug = normalizeDistrictSlug((row as { district?: unknown }).district);
    const specialtySlug = normalizeSpecialtySlug((row as { specialty?: unknown }).specialty);
    if (!districtSlug || !specialtySlug || specialtySlug === "all") continue;
    pairSet.add(`${districtSlug}::${specialtySlug}`);
  }

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
    finder_visible?: boolean | null;
    is_test_profile?: boolean | null;
    is_registered?: boolean | null;
    status?: string | null;
    name?: string | null;
  };
  let manualSlugRes: {
    data: ManualSitemapSlugRow[] | null;
    error: { code?: string; message?: string } | null;
  } = await fetchAllSupabaseRows(() =>
    supabase
      .from("professionals")
      .select("slug, finder_visible, is_test_profile, is_registered, status, name")
      .eq("is_archived", false)
      .eq("finder_visible", true)
      .not("slug", "is", null),
  );

  if (
    manualSlugRes.error &&
    (String(manualSlugRes.error.message ?? "").toLowerCase().includes("finder_visible") ||
      (manualSlugRes.error as { code?: string }).code === "42703")
  ) {
    const fallback = await fetchAllSupabaseRows(() =>
      supabase
        .from("professionals")
        .select("slug")
        .eq("is_archived", false)
        .eq("is_registered", false)
        .not("slug", "is", null),
    );
    manualSlugRes = {
      data: (fallback.data ?? []).map((row) => ({
        slug: (row as { slug?: string | null }).slug,
      })),
      error: fallback.error,
    };
  }

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
        if (row.finder_visible === false) return null;
        if (row.is_test_profile) return null;
        if (/\btest\b/i.test(String(row.name ?? ""))) return null;
        if (row.is_registered && String(row.status ?? "").trim().toLowerCase() !== "verified") {
          return null;
        }
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
