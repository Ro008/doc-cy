import type { SupabaseClient } from "@supabase/supabase-js";
import { publicSpecialtyLabels } from "@/lib/doctor-specialties";
import { normalizeDistrictForSeoTitle, resolveShareAvatarUrl } from "@/lib/doctor-seo-formatting";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import { profileCustomizationFromRow } from "@/lib/profile-customization";
import { primaryClinicLocationFields } from "@/lib/professional-clinic-locations";
import { loadPublishedReviews } from "@/lib/public/load-profile-reviews";
import { heroRatingFromReviews } from "@/lib/public/profile-reviews";
import type { ProfileShareCardFacts } from "@/lib/public/profile-share-card";
import {
  SPECIALTY_ROWS_SELECT,
  primarySpecialtyEntry,
  specialtyEntriesFromRows,
  specialtyNames,
} from "@/lib/specialty-catalogue";

export type ProfileShareCard = { facts: ProfileShareCardFacts; avatarUrl: string | null };

/**
 * What the share card draws, for a registered professional by slug: the same facts, read the
 * same way, as the profile's own metadata (that is what lets the route check the `v` in the
 * link). Public data only, read only. When the accent column exists (the customization
 * contract in lib/profile-customization.ts), select it here and in generateMetadata together.
 */
export async function loadProfileShareCard(
  supabase: SupabaseClient,
  slug: string,
): Promise<ProfileShareCard | null> {
  const { data: row } = await supabase
    .from("professionals")
    .select(`id, name, avatar_url, ${SPECIALTY_ROWS_SELECT}`)
    .eq("is_registered", true)
    .eq("is_archived", false)
    .eq("slug", slug)
    .maybeSingle();
  const professional = row as unknown as {
    id: string;
    name: string | null;
    avatar_url: string | null;
    specialty_rows?: unknown;
  } | null;
  if (!professional) return null;

  const entries = specialtyEntriesFromRows(professional.specialty_rows);
  const [locations, reviews] = await Promise.all([
    loadDoctorLocations(professional.id),
    loadPublishedReviews(supabase, professional.id),
  ]);
  const avatarPath = String(professional.avatar_url ?? "").trim();
  return {
    facts: {
      name: String(professional.name ?? ""),
      avatarPath: avatarPath || null,
      accent: profileCustomizationFromRow(professional).accent,
      specialties: publicSpecialtyLabels({
        specialties: specialtyNames(entries),
        specialty: primarySpecialtyEntry(entries)?.name ?? "",
      }),
      district: normalizeDistrictForSeoTitle(primaryClinicLocationFields(locations).district),
      rating: heroRatingFromReviews(reviews),
    },
    avatarUrl: resolveShareAvatarUrl(
      avatarPath,
      (path) => supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl,
    ),
  };
}
