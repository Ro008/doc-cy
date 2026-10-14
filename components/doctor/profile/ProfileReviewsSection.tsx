import { format } from "date-fns";
import { enGB, el as elLocale } from "date-fns/locale";
import { utcToZonedTime } from "date-fns-tz";
import { MessageSquareQuote } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProfileHeadingIcon } from "@/components/doctor/profile/ProfileHeadingIcon";
import { CY_TZ } from "@/lib/appointments";
import { ProfileStars } from "@/components/doctor/profile/ProfileStars";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";
import { ProfileReviewsList } from "@/components/doctor/profile/ProfileReviewsList";
import { summariseReviews, type PublicReview } from "@/lib/public/profile-reviews";

/**
 * "Patient reviews": the verified reviews patients leave from the emailed link, read from
 * professional_reviews. Hidden when there are none (no empty box, nothing invented). The
 * first few are open; "Show more reviews" opens the next ones (ProfileReviewsList).
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

  const card = (review: PublicReview) => (
    <li
      key={review.id}
      data-testid="profile-review"
      className="flex flex-col gap-2 px-5 py-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ProfileStars rating={review.rating} label={t("reviewRatingLabel", { rating: review.rating })} />
        <span className="text-sm font-bold text-profile-text">{review.name}</span>
        <time dateTime={review.createdAt} className="ml-auto text-sm font-medium text-profile-muted">
          {format(utcToZonedTime(new Date(review.createdAt), CY_TZ), "d MMM yyyy", { locale: dateLocale })}
        </time>
      </div>
      <p className="max-w-prose whitespace-pre-wrap break-words text-[15px] leading-relaxed text-profile-body">
        {review.comment}
      </p>
    </li>
  );

  return (
    <section
      id={PROFILE_SECTION_IDS.reviews}
      aria-labelledby="profile-reviews-heading"
      className="grid scroll-mt-20 gap-5"
    >
      <div>
        <h2
          id="profile-reviews-heading"
          className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-profile-text sm:text-[28px]"
        >
          <ProfileHeadingIcon icon={MessageSquareQuote} />
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

      <ProfileReviewsList items={reviews.map(card)} moreLabel={t("reviewsShowMore")} />
    </section>
  );
}
