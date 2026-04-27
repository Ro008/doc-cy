import type { MetadataRoute } from "next";
import { CYPRUS_DISTRICTS, isCyprusDistrict, type CyprusDistrict } from "@/lib/cyprus-districts";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { districtToSlug, specialtyToSlug, slugToDistrict } from "@/lib/finder-seo";

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
  return specialtyToSlug(raw);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/finder`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  const supabase = createServiceRoleClient();
  if (!supabase) return staticEntries;

  // Registered professionals live in `doctors` (verified + public slug).
  // We also attempt `profiles` for backward compatibility with older naming.
  const [doctorsRes, profilesRes, manualRes] = await Promise.all([
    supabase
      .from("doctors")
      .select("district, specialty, is_test_profile, name")
      .eq("status", "verified")
      .not("slug", "is", null)
      .limit(5000),
    supabase
      .from("profiles")
      .select("district, specialty")
      .eq("status", "verified")
      .limit(5000),
    supabase
      .from("directory_manual")
      .select("district, specialty")
      .eq("is_archived", false)
      .limit(5000),
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
  for (const pair of pairSet) {
    districtSet.add(pair.split("::")[0]);
  }
  // Keep canonical Cyprus district slugs constrained to expected english set.
  for (const district of CYPRUS_DISTRICTS) {
    const districtSlug = districtToSlug(district);
    if (districtSet.has(districtSlug)) {
      staticEntries.push({
        url: `${siteUrl}/finder/${districtSlug}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  }

  const dynamicFinderEntries: MetadataRoute.Sitemap = [...pairSet]
    .sort((a, b) => a.localeCompare(b))
    .map((pair) => {
      const [districtSlug, specialtySlug] = pair.split("::");
      return {
        url: `${siteUrl}/finder/${districtSlug}/${specialtySlug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.8,
      };
    });

  return [...staticEntries, ...dynamicFinderEntries];
}

