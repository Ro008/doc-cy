import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllSupabaseRows, fetchAllSupabaseRowsForIdChunks } from "@/lib/supabase-fetch-all";
import {
  finderRatingsFromRows,
  publicReviewsFromRows,
  type FinderRating,
  type ProfileReviewRow,
  type PublicReview,
} from "@/lib/public/profile-reviews";

/**
 * The published reviews of one professional, newest first. Read only: reviews are written
 * by POST /api/booking/review, and founders hide one by setting its status. The table is
 * service role only, so `supabase` is the public page's service client. The email column
 * is not selected. A failed read shows no reviews rather than breaking the profile.
 */
export async function loadPublishedReviews(
  supabase: SupabaseClient,
  professionalId: string,
): Promise<PublicReview[]> {
  const { data, error } = await fetchAllSupabaseRows<ProfileReviewRow>(() =>
    supabase
      .from("professional_reviews")
      .select("id, rating, comment, reviewer_name, created_at, status")
      .eq("professional_id", professionalId)
      .eq("status", "published")
      .order("created_at", { ascending: false }),
  );
  if (error) {
    console.error("[DocCy] professional_reviews fetch failed:", error);
    return [];
  }
  return publicReviewsFromRows(data);
}

/**
 * The notes for the finder cards on screen: published ratings of just those professionals,
 * in id chunks (a page is a dozen or a few dozen cards), reduced to count + average.
 * Professionals under the bar get no entry. Read only; a failed read shows no notes.
 */
export async function loadPublishedRatings(
  supabase: SupabaseClient,
  professionalIds: readonly string[],
): Promise<Map<string, FinderRating>> {
  if (professionalIds.length === 0) return new Map();
  const { data, error } = await fetchAllSupabaseRowsForIdChunks<{
    professional_id: string;
    rating: number;
    status: string;
  }>(professionalIds, (idChunk) =>
    supabase
      .from("professional_reviews")
      .select("professional_id, rating, status")
      .eq("status", "published")
      .in("professional_id", idChunk)
      .order("created_at", { ascending: false }),
  );
  if (error) {
    console.error("[DocCy] finder professional_reviews fetch failed:", error);
    return new Map();
  }
  return finderRatingsFromRows(data);
}
