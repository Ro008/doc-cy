import type { ReactNode } from "react";
import { Building2, Clock, MapPin, Phone } from "lucide-react";
import { PendingLink } from "@/components/navigation/PendingLink";
import { RevealPhoneButton } from "@/components/finder/RevealPhoneButton";
import { clinicLandingPath } from "@/lib/clinic-landing-path";
import { stripPlusCodePrefix } from "@/lib/clinic-location-pin";

// The profile's clinic buttons (ProfileBookingPanel), 44 px tall for a thumb (mockup L).
const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-profile-muted px-3.5 text-sm font-bold text-profile-text transition-none hover:border-accent disabled:cursor-wait disabled:opacity-60";

/**
 * The card's clinic, as the profile shows it (mockup L; user, 2026-10-16): its name (its
 * page), the address, the opening hours, then Call and Open in Maps. The phone is fetched
 * on the click and recorded in user_events. On a phone a rule sets it apart from the week
 * above, and the two buttons share the width. A listing's Claim and Report go under it.
 */
export function FinderCardClinicColumn({
  clinic,
  address,
  mapsHref,
  phone,
  hours = [],
  footer = null,
}: {
  clinic: { name: string; slug?: string | null } | null;
  address: string | null;
  mapsHref: string | null;
  /** The clinic's phone; `call-to-book` on listings (Ads conversion), plain on registered cards. */
  phone: { clinicId: string; manualId: string; variant: "call-to-book" | "show-phone-number" } | null;
  /** Opening hours, grouped as on the profile; none for a listing. */
  hours?: ReadonlyArray<{ days: string; hours: string }>;
  footer?: ReactNode;
}) {
  const name = String(clinic?.name ?? "").trim();
  const slug = String(clinic?.slug ?? "").trim();
  const line = stripPlusCodePrefix(String(address ?? "").trim());

  return (
    <section
      aria-label="Clinic"
      data-testid="finder-card-clinic"
      className="flex min-w-0 flex-col gap-2 border-t border-profile-border pt-4 text-sm text-profile-body lg:gap-[9px] lg:border-t-0 lg:pt-0"
    >
      {name ? (
        <p className="flex min-w-0 items-start gap-2">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-link" aria-hidden />
          {slug ? (
            <PendingLink
              href={clinicLandingPath(slug)}
              navigationReason="profile"
              prefetch={false}
              className="min-w-0 font-bold text-accent-link transition-none hover:underline"
            >
              <span className="line-clamp-2" title={name}>
                {name}
              </span>
            </PendingLink>
          ) : (
            <span className="line-clamp-2 min-w-0 font-bold text-accent-link" title={name}>
              {name}
            </span>
          )}
        </p>
      ) : null}
      <p className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-link" aria-hidden />
        <span className="line-clamp-2" title={line || undefined}>
          {line || "Address not provided yet"}
        </span>
      </p>
      {hours.length > 0 ? (
        <div data-testid="finder-card-clinic-hours" className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-link" aria-hidden />
          <dl aria-label="Opening hours" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
            {hours.map((row) => (
              <div key={row.days} className="contents">
                <dt className="font-semibold text-profile-text">{row.days}</dt>
                <dd className="tabular-nums">{row.hours}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {phone || mapsHref ? (
        <div className="mt-0.5 grid grid-cols-2 gap-2 lg:flex lg:flex-wrap">
          {phone ? (
            <RevealPhoneButton
              kind="clinic"
              id={phone.clinicId}
              hasPhone
              variant={phone.variant}
              source="finder_card"
              manualId={phone.manualId}
              label="Call"
              icon={<Phone className="h-4 w-4 shrink-0" aria-hidden />}
              wrapperClassName="flex min-w-0 flex-col gap-1"
              className={buttonClass}
              revealedClassName={`${buttonClass} tabular-nums`}
            />
          ) : null}
          {mapsHref ? (
            <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={buttonClass}>
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              Open in Maps
            </a>
          ) : null}
        </div>
      ) : null}
      {footer ? (
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-xs" data-testid="finder-listing-footer">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
