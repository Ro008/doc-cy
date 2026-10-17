import type { ReactNode } from "react";
import { Languages, Star, Users } from "lucide-react";
import { GesyProviderBadge } from "@/components/brand/GesyProviderBadge";
import { FinderCardPhotoZoom } from "@/components/finder/FinderCardPhotoZoom";
import { FinderCardReviewsButton } from "@/components/finder/FinderCardReviewsButton";
import { FinderSpecialtyLink } from "@/components/finder/FinderSpecialtyLink";
import { FinderPopupLink } from "@/components/finder/FinderProfilePopup";
import { harmonizeFinderSpecialtyList } from "@/lib/finder-specialty-harmonize";
import type { FinderRating } from "@/lib/public/profile-reviews";

/**
 * Who she is, as her profile's hero, small: the photo tile, the name, the rating with her
 * reviews, the specialty pills with GeSY, then the facts. Mockup O (user, 2026-10-16): a
 * quiet pale panel instead of the teal band, teal only in small things; from lg it is a
 * panel down the left of the card, so every card has the same shape to scan down.
 */
export function FinderProfileCardHero({
  name,
  href,
  hrefLabel,
  photo,
  zoomPhoto = null,
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
  /** Her own photo, opened larger on a click (mockup R3); null for a default avatar. */
  zoomPhoto?: { src: string } | null;
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
    "row-span-1 h-16 w-14 shrink-0 overflow-hidden rounded-[20px] bg-[#D5EEF0] [.doccy-profile[data-scheme=dark]_&]:bg-[#22446F] sm:row-span-2 sm:h-28 sm:w-24 lg:row-span-1 lg:h-[84px] lg:w-[72px]";

  // Teal only in small things: white pills with a teal outline (dark: outlined on the panel).
  const pill = `inline-flex rounded-full border border-[#BFE0E3] bg-profile-surface px-3 py-[5px] text-[13px] font-bold text-accent-link [.doccy-profile[data-scheme=dark]_&]:border-[#3A5B87] [.doccy-profile[data-scheme=dark]_&]:bg-transparent`;

  return (
    <header
      data-testid="finder-card-hero"
      className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)] content-start items-start gap-x-3 gap-y-3 rounded-[20px] bg-[#EEF6F7] p-4 text-[#3B4F63] [.doccy-profile[data-scheme=dark]_&]:bg-[#17335A] [.doccy-profile[data-scheme=dark]_&]:text-[#CBD5E1] sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-x-5 sm:px-6 sm:py-[22px] lg:grid-cols-[72px_minmax(0,1fr)] lg:p-[22px]"
    >
      {zoomPhoto ? (
        <FinderCardPhotoZoom src={zoomPhoto.src} name={name} meta={pills.join(" · ")} className={tile}>
          {photo}
        </FinderCardPhotoZoom>
      ) : href ? (
        <FinderPopupLink href={href} fill aria-label={hrefLabel} className={tile}>
          {photo}
        </FinderPopupLink>
      ) : (
        <div className={tile}>{photo}</div>
      )}

      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3.5 gap-y-1 self-center">
        {href ? (
          <FinderPopupLink
            href={href}
            className="text-xl font-bold leading-[1.15] tracking-[-0.015em] text-profile-text transition-none hover:underline sm:text-[26px] lg:text-[22px]"
          >
            {name}
          </FinderPopupLink>
        ) : (
          <p className="text-xl font-bold leading-[1.15] tracking-[-0.015em] text-profile-text sm:text-[26px] lg:text-[22px]">{name}</p>
        )}
        {rating ? (
          <span
            data-testid="finder-card-rating"
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-[15px] font-semibold text-profile-text"
          >
            <Star className="h-4 w-4 fill-current text-[#B45309] [.doccy-profile[data-scheme=dark]_&]:text-[#FBBF24]" aria-hidden />
            <span className="tabular-nums" aria-label={`${rating.average.toFixed(1)} out of 5 stars`}>
              {rating.average.toFixed(1)}
            </span>
            <span aria-hidden>·</span>
            <FinderCardReviewsButton professionalId={professionalId} name={name} count={rating.count} profileHref={href} />
          </span>
        ) : null}
      </div>

      <div className="col-span-2 flex min-w-0 flex-col gap-2.5 sm:col-span-1 sm:col-start-2 lg:col-span-2 lg:col-start-1">
        <div className="flex flex-wrap items-center gap-1.5" data-testid="finder-card-specialties">
          {pills.length === 0 ? (
            <span className={pill}>
              Specialty not set
            </span>
          ) : (
            pills.map((label) => (
              <FinderSpecialtyLink
                key={label}
                specialty={label}
                district={district}
                className={`${pill} max-w-full items-center text-left transition-none hover:underline`}
              >
                {label}
              </FinderSpecialtyLink>
            ))
          )}
          {isGesy ? (
            <span data-testid="finder-card-gesy" className="ml-1 inline-flex items-center">
              {/* The colour mark on the pale panel; its white-text copy in dark. */}
              <GesyProviderBadge size="line" language="en" tooltipAlign="right" />
            </span>
          ) : null}
        </div>
        {languages || patientsSeen || mobile || distance ? (
          <div className="flex flex-col items-start gap-y-1 text-sm font-medium sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 lg:flex-col lg:items-start [&_svg]:text-accent-link">
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
