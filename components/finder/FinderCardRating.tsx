import { Star } from "lucide-react";
import type { FinderRating } from "@/lib/public/profile-reviews";

/**
 * The note on a registered finder card: "★ 4.6 (12)". Only given for professionals with
 * enough reviews (lib/public/profile-reviews: finderRatingsFromRows), so it never shows one
 * lone opinion. The finder is plain English, like the rest of its cards.
 */
export function FinderCardRating({ rating }: { rating: FinderRating }) {
  const average = rating.average.toFixed(1);
  const reviews = `${rating.count} ${rating.count === 1 ? "review" : "reviews"}`;
  return (
    <p
      data-testid="finder-card-rating"
      aria-label={`${average} out of 5 stars, ${reviews}`}
      className="inline-flex items-center gap-1 self-start text-xs font-semibold text-site-ink-900"
    >
      <Star className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" aria-hidden />
      <span className="tabular-nums" aria-hidden>
        {average}
      </span>
      <span className="font-medium text-site-ink-600" aria-hidden>
        ({rating.count})
      </span>
    </p>
  );
}
