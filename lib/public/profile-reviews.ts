import { buildRegisteredProfileMetaDescription } from "@/lib/doctor-seo-formatting";
import { reviewDisplayName } from "@/lib/review-display-name";

/**
 * What the public profile shows of a verified review (professional_reviews, written by
 * POST /api/booking/review): first name + last initial, rating, comment, date. The email and
 * the full name never leave the server.
 */

/** Reviews open on the page; the rest sit behind "Show all". */
export const PROFILE_REVIEWS_SHOWN_FIRST = 4;

/** The hero shows the average only from this many reviews: one opinion alone weighs too much there. */
export const PROFILE_HERO_RATING_MIN_REVIEWS = 3;

export function showHeroRating(reviewCount: number): boolean {
  return reviewCount >= PROFILE_HERO_RATING_MIN_REVIEWS;
}

export type ProfileReviewRow = {
  id?: unknown;
  rating?: unknown;
  comment?: unknown;
  reviewer_name?: unknown;
  created_at?: unknown;
  status?: unknown;
};

export type PublicReview = {
  id: string;
  rating: number;
  comment: string;
  name: string;
  createdAt: string;
};

export function publicReviewsFromRows(rows: readonly ProfileReviewRow[] | null | undefined): PublicReview[] {
  const reviews: PublicReview[] = [];
  for (const row of rows ?? []) {
    if (row.status !== "published") continue;
    const rating = row.rating;
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) continue;
    const comment = typeof row.comment === "string" ? row.comment.trim() : "";
    if (!comment) continue;
    reviews.push({
      id: String(row.id ?? ""),
      rating,
      comment,
      name: reviewDisplayName(typeof row.reviewer_name === "string" ? row.reviewer_name : null),
      createdAt: String(row.created_at ?? ""),
    });
  }
  return reviews.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** The average is cut, not rounded, to one decimal: 24 fives and a four read 4.9, never 5.0. */
function cutAverage(ratings: readonly number[]): number {
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return Math.floor((total / ratings.length) * 10 + 1e-9) / 10;
}

export function summariseReviews(reviews: readonly PublicReview[]): { count: number; average: number | null } {
  if (reviews.length === 0) return { count: 0, average: null };
  return { count: reviews.length, average: cutAverage(reviews.map((review) => review.rating)) };
}

export type FinderRating = { count: number; average: number };

/**
 * The note on a finder card, per professional: published reviews only, and only from the
 * same bar as the profile hero (3 reviews). Below it a card shows nothing. The ratings come
 * without comments or names: the finder needs just the numbers.
 */
export function finderRatingsFromRows(
  rows: ReadonlyArray<{ professional_id?: unknown; rating?: unknown; status?: unknown }> | null | undefined,
): Map<string, FinderRating> {
  const byProfessional = new Map<string, number[]>();
  for (const row of rows ?? []) {
    if (row.status !== "published") continue;
    const rating = row.rating;
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) continue;
    const id = String(row.professional_id ?? "");
    if (!id) continue;
    const list = byProfessional.get(id) ?? [];
    list.push(rating);
    byProfessional.set(id, list);
  }
  const ratings = new Map<string, FinderRating>();
  for (const [id, list] of byProfessional) {
    if (showHeroRating(list.length)) ratings.set(id, { count: list.length, average: cutAverage(list) });
  }
  return ratings;
}

const SHARE_DESCRIPTION_MAX = 160;

/**
 * The line under a shared profile link (WhatsApp, social previews): the note first, when
 * the professional has enough reviews, then what the person can do. Kept under 160
 * characters so chat apps do not cut it mid-sentence: the specialties give way first.
 * Without a note it is the description the page already had. The description Google reads
 * stays buildRegisteredProfileMetaDescription (a positioning decision, not changed here).
 */
export function buildShareDescription(input: {
  doctorName: string;
  specialtyForSeo: string;
  cityLabel: string;
  rating: FinderRating | null;
}): string {
  if (!input.rating) return buildRegisteredProfileMetaDescription(input);
  const { count, average } = input.rating;
  const lead = `★ ${average.toFixed(1)} (${count} ${count === 1 ? "review" : "reviews"}) · `;
  const city = input.cityLabel.trim() || "Cyprus";
  const action = `Book online with ${input.doctorName.trim()} in ${city}.`;
  const specialties = input.specialtyForSeo
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  for (let keep = specialties.length; keep > 0; keep -= 1) {
    const text = `${lead}${action} ${specialties.slice(0, keep).join(", ")}.`;
    if (text.length <= SHARE_DESCRIPTION_MAX) return text;
  }
  return `${lead}${action}`;
}

/** Count and average for the places that show one note per professional (share preview, share card): null below the bar. */
export function heroRatingFromReviews(reviews: readonly PublicReview[]): FinderRating | null {
  const { count, average } = summariseReviews(reviews);
  return showHeroRating(count) && average !== null ? { count, average } : null;
}
