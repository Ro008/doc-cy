import type { ReactNode } from "react";
import { Languages, Star, Users } from "lucide-react";
import { GesyProviderBadge } from "@/components/brand/GesyProviderBadge";
import { FinderCardReviewsButton } from "@/components/finder/FinderCardReviewsButton";
import { FinderSpecialtyLink } from "@/components/finder/FinderSpecialtyLink";
import { PendingLink } from "@/components/navigation/PendingLink";
import { harmonizeFinderSpecialtyList } from "@/lib/finder-specialty-harmonize";
import type { FinderRating } from "@/lib/public/profile-reviews";

/**
 * The card's top as her profile's hero, small (mockup L; user, 2026-10-16): the photo tile,
 * the name, the rating with her reviews, the specialty pills with GeSY, then one quiet line
 * of facts. Same colours as the profile (the Finder sits in SiteSchemeRoot).
 */
export function FinderProfileCardHero({
  name,
  href,
  hrefLabel,
  photo,
  rating = null,
  professionalId,
  specialties,
  specialty = null,
  district = null,
  isGesy,
  languages = "",
  patientsSeen = null,
  mobile = null,
  distance = null,
}: {
  name: string;
  /** Her profile or listing page; null when she has none. */
  href: string | null;
  hrefLabel: string;
  /** The photo, or the default avatar (an <img> filling the tile). */
  photo: ReactNode;
  rating?: FinderRating | null;
  professionalId: string;
  specialties: readonly string[];
  specialty?: string | null;
  district?: string | null;
  isGesy: boolean;
  /** "Greek, English"; nothing shows when empty. */
  languages?: string;
  patientsSeen?: string | null;
  /** Show mobile (streamed in: only professionals who show it on their profile). */
  mobile?: ReactNode;
  distance?: ReactNode;
}) {
  const pills = harmonizeFinderSpecialtyList(
    specialties.length > 0 ? specialties : [String(specialty ?? "").trim()].filter(Boolean),
  );
  const tile =
    "row-span-1 h-16 w-14 shrink-0 overflow-hidden rounded-[20px] bg-accent-avatar sm:row-span-2 sm:h-28 sm:w-24";

  return (
    <header
      data-testid="finder-card-hero"
      className="grid grid-cols-[56px_minmax(0,1fr)] content-start items-start gap-x-3 gap-y-3 rounded-[22px] bg-accent p-4 text-accent-on sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-x-5 sm:px-6 sm:py-[22px] lg:min-h-[186px]"
    >
      {href ? (
        <PendingLink
          href={href}
          navigationReason="profile"
          fill
          prefetch={false}
          aria-label={hrefLabel}
          className={tile}
        >
          {photo}
        </PendingLink>
      ) : (
        <div className={tile}>{photo}</div>
      )}

      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3.5 gap-y-1 self-center">
        {href ? (
          <PendingLink
            href={href}
            navigationReason="profile"
            prefetch={false}
            className="text-xl font-semibold leading-[1.15] tracking-[-0.015em] text-accent-on transition-none hover:underline sm:text-[26px]"
          >
            {name}
          </PendingLink>
        ) : (
          <p className="text-xl font-semibold leading-[1.15] tracking-[-0.015em] sm:text-[26px]">{name}</p>
        )}
        {rating ? (
          <span
            data-testid="finder-card-rating"
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-[15px] font-semibold"
          >
            <Star className="h-4 w-4 fill-current" aria-hidden />
            <span className="tabular-nums" aria-label={`${rating.average.toFixed(1)} out of 5 stars`}>
              {rating.average.toFixed(1)}
            </span>
            <span aria-hidden>·</span>
            <FinderCardReviewsButton professionalId={professionalId} name={name} count={rating.count} profileHref={href} />
          </span>
        ) : null}
      </div>

      <div className="col-span-2 flex min-w-0 flex-col gap-2.5 sm:col-span-1 sm:col-start-2">
        <div className="flex flex-wrap items-center gap-1.5" data-testid="finder-card-specialties">
          {pills.length === 0 ? (
            <span className="inline-flex rounded-full bg-accent-on px-3 py-1.5 text-sm font-bold text-accent">
              Specialty not set
            </span>
          ) : (
            pills.map((label) => (
              <FinderSpecialtyLink
                key={label}
                specialty={label}
                district={district}
                className="inline-flex max-w-full items-center rounded-full bg-accent-on px-3 py-1.5 text-left text-sm font-bold text-accent transition-none hover:opacity-90"
              >
                {label}
              </FinderSpecialtyLink>
            ))
          )}
          {isGesy ? (
            <span data-testid="finder-card-gesy" className="ml-1 inline-flex items-center">
              {/* The official mark alone, transparent on the hero's colour, as on her profile. */}
              <GesyProviderBadge size="xs" language="en" variant="mono" tooltipAlign="right" className="[&_img]:h-7" />
            </span>
          ) : null}
        </div>
        {languages || patientsSeen || mobile || distance ? (
          <div className="flex flex-col items-start gap-y-1 text-sm font-medium sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
            {languages ? (
              <span className="inline-flex items-start gap-x-2" data-testid="finder-card-languages">
                <Languages className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>Speaks {languages}</span>
              </span>
            ) : null}
            {patientsSeen ? (
              <span className="inline-flex items-center gap-x-2">
                <Users className="h-4 w-4 shrink-0" aria-hidden />
                {patientsSeen}
              </span>
            ) : null}
            {mobile}
            {distance}
          </div>
        ) : null}
      </div>
    </header>
  );
}
