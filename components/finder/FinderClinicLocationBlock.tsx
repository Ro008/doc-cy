import { PendingLink } from "@/components/navigation/PendingLink";
import { clinicLandingPath } from "@/lib/clinic-landing-path";

export type FinderClinicRef = {
  name: string;
  slug: string;
};

type FinderClinicLocationBlockProps = {
  district: string;
  /** Street / clinic address in plain text when available. */
  address?: string | null;
  /** Google Maps URL for the listing location. */
  addressMapsLink?: string | null;
  clinic: FinderClinicRef | null;
};

/**
 * Location block for manual finder / landing cards.
 * Clinic name (clickable when linked) + address text (district as fallback)
 * + separate "Open in Maps" CTA when a maps URL exists.
 */
export function FinderClinicLocationBlock({
  district,
  address,
  addressMapsLink,
  clinic,
}: FinderClinicLocationBlockProps) {
  const clinicHref = clinic?.slug ? clinicLandingPath(clinic.slug) : null;
  const addressText = String(address ?? "").trim();
  const locationLine = addressText || district;
  const mapsHref = String(addressMapsLink ?? "").trim() || null;

  return (
    <div>
      {clinic && clinicHref ? (
        <PendingLink
          href={clinicHref}
          navigationReason="profile"
          prefetch={false}
          className="mb-1 block text-sm font-semibold leading-snug text-ink-800 transition-none hover:text-clinical-600"
        >
          {clinic.name}
        </PendingLink>
      ) : clinic ? (
        <p className="mb-1 text-sm font-semibold leading-snug text-ink-800">{clinic.name}</p>
      ) : null}
      <p className="text-xs leading-relaxed text-ink-600 whitespace-pre-wrap break-words">
        {locationLine}
      </p>
      {mapsHref ? (
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex text-xs font-semibold text-clinical-700 transition-none underline-offset-2 hover:text-clinical-600 hover:underline"
        >
          Open in Maps ↗
        </a>
      ) : null}
    </div>
  );
}
