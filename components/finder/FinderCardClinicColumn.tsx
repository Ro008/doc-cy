import { MapPin, Phone } from "lucide-react";
import { RevealMobileButton } from "@/components/doctor/profile/RevealMobileButton";
import { PendingLink } from "@/components/navigation/PendingLink";
import { RevealPhoneButton } from "@/components/finder/RevealPhoneButton";
import { clinicLandingPath } from "@/lib/clinic-landing-path";
import { stripPlusCodePrefix } from "@/lib/clinic-location-pin";

const linkClass =
  "inline-flex items-center text-[13px] font-semibold leading-5 text-site-clinical-700 transition-none hover:underline disabled:cursor-wait disabled:opacity-60";

/**
 * Where, on G's finder card (Finder G, step 4; user, 2026-10-16): the clinic's name (its
 * page), the address, then Open in Maps · Clinic phone · Mobile Number. Both phones are
 * fetched on the click and recorded in user_events; the mobile only shows for a
 * professional who shows it on her profile.
 */
export function FinderCardClinicColumn({
  clinic,
  address,
  mapsHref,
  phone,
  mobileProfessionalId = null,
}: {
  clinic: { name: string; slug?: string | null } | null;
  address: string | null;
  mapsHref: string | null;
  /** The clinic's phone; `call-to-book` on listings (Ads conversion), plain on registered cards. */
  phone: { clinicId: string; manualId: string; variant: "call-to-book" | "show-phone-number" } | null;
  mobileProfessionalId?: string | null;
}) {
  const name = String(clinic?.name ?? "").trim();
  const slug = String(clinic?.slug ?? "").trim();
  const line = stripPlusCodePrefix(String(address ?? "").trim());

  return (
    <div className="min-w-0" data-testid="finder-card-clinic">
      <div className="min-w-0">
        {name ? (
          slug ? (
            <PendingLink
              href={clinicLandingPath(slug)}
              navigationReason="profile"
              prefetch={false}
              className="text-[15px] font-bold text-site-ink-900 underline decoration-site-ink-200 underline-offset-[3px] transition-none hover:text-site-clinical-700"
            >
              <span className="line-clamp-1" title={name}>
                {name}
              </span>
            </PendingLink>
          ) : (
            <p className="line-clamp-1 text-[15px] font-bold text-site-ink-900" title={name}>
              {name}
            </p>
          )
        ) : null}
        <p className="mt-1 line-clamp-2 min-h-[39px] text-[13px] leading-normal text-site-ink-500" title={line || undefined}>
          {line || "Address not provided yet"}
        </p>
        {/* Two rows on a phone, where Mobile Number wraps: every card keeps the same height. */}
        <div className="mt-1.5 flex min-h-[48px] flex-wrap content-start items-center gap-x-3 gap-y-1 sm:min-h-0">
          {mapsHref ? (
            // The pin sits on the link that opens a map, not on the clinic's name (user, 2026-10-16).
            <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={`${linkClass} gap-1.5`}>
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              Open in Maps
            </a>
          ) : null}
          {phone ? (
            <RevealPhoneButton
              kind="clinic"
              id={phone.clinicId}
              hasPhone
              variant={phone.variant}
              source="finder_card"
              manualId={phone.manualId}
              label="Clinic phone"
              icon={<Phone className="h-4 w-4 shrink-0" aria-hidden />}
              wrapperClassName="flex flex-col gap-1"
              className={linkClass}
              revealedClassName={`${linkClass} gap-1.5 tabular-nums`}
            />
          ) : null}
          {mobileProfessionalId ? (
            <RevealMobileButton
              professionalId={mobileProfessionalId}
              source="finder_card"
              label="Mobile Number"
              loadingLabel="Loading…"
              errorLabel="Could not load the number"
              className={linkClass}
              testId="finder-card-mobile"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
