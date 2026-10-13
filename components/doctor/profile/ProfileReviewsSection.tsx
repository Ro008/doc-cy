import { format } from "date-fns";
import { enGB, el as elLocale } from "date-fns/locale";
import { utcToZonedTime } from "date-fns-tz";
import { getTranslations } from "next-intl/server";
import { CY_TZ } from "@/lib/appointments";
import { ProfileStars } from "@/components/doctor/profile/ProfileStars";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";
import {
  PROFILE_REVIEWS_SHOWN_FIRST,
  summariseReviews,
  type PublicReview,
} from "@/lib/public/profile-reviews";

/**
 * "Patient reviews": the verified reviews patients leave from the emailed link, read from
 * professional_reviews. Hidden when there are none (no empty box, nothing invented). The
 * first few are open; the rest are behind a native <details>, so it works without scripts.
 */
export async function ProfileReviewsSection({
  reviews,
  locale,
}: {
  reviews: readonly PublicReview[];
  locale: string;
}) {
  if (reviews.length === 0) return null;
  const t = await getTranslations("DoctorProfilePage");
  const { count, average } = summariseReviews(reviews);
  const dateLocale = locale === "el" ? elLocale : enGB;
  const first = reviews.slice(0, PROFILE_REVIEWS_SHOWN_FIRST);
  const rest = reviews.slice(PROFILE_REVIEWS_SHOWN_FIRST);

  const card = (review: PublicReview) => (
    <li
      key={review.id}
      data-testid="profile-review"
      className="flex flex-col gap-2 rounded-2xl border border-profile-border bg-profile-surface px-5 py-4"
    >
      <div className="flex items-center justify-between gap-3">
        <ProfileStars rating={review.rating} label={t("reviewRatingLabel", { rating: review.rating })} />
        <time dateTime={review.createdAt} className="text-sm font-medium text-profile-muted">
          {format(utcToZonedTime(new Date(review.createdAt), CY_TZ), "d MMM yyyy", { locale: dateLocale })}
        </time>
      </div>
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-profile-body">
        {review.comment}
      </p>
      <p className="text-sm font-bold text-profile-text">{review.name}</p>
    </li>
  );

  return (
    <section
      id={PROFILE_SECTION_IDS.reviews}
      aria-labelledby="profile-reviews-heading"
      className="grid scroll-mt-20 gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8"
    >
      <div>
        <h2
          id="profile-reviews-heading"
          className="text-2xl font-extrabold tracking-tight text-profile-text sm:text-[28px]"
        >
          {t("reviewsHeading")}
        </h2>
        <div className="mt-3 flex items-center gap-3" data-testid="profile-reviews-summary">
          <span className="text-4xl font-extrabold tabular-nums text-profile-text">
            {average?.toFixed(1)}
          </span>
          <div className="flex flex-col gap-1">
            <ProfileStars
              rating={average ?? 0}
              label={t("reviewRatingLabel", { rating: average?.toFixed(1) ?? "0" })}
              size="h-5 w-5"
            />
            <span className="text-sm font-semibold text-profile-muted">{t("reviewsSummary", { count })}</span>
          </div>
        </div>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-profile-muted">{t("reviewsVerifiedNote")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <ul className="grid gap-3 sm:grid-cols-2">{first.map(card)}</ul>
        {rest.length > 0 ? (
          <details className="group">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-full border-2 border-accent-soft px-5 text-sm font-bold text-profile-text transition hover:border-accent-cta focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cta [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">{t("reviewsShowAll", { count })}</span>
              <span className="hidden group-open:inline">{t("reviewsShowFewer")}</span>
            </summary>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">{rest.map(card)}</ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}
