import { PendingLink } from "@/components/navigation/PendingLink";
import { clinicLandingPath } from "@/lib/clinic-landing-path";
import {
  formatClinicCountLabel,
  formatMoreClinicsLabel,
} from "@/lib/manual-directory-clinics";

export type FinderClinicRef = {
  name: string;
  slug: string;
  address?: string | null;
  addressMapsLink?: string | null;
  district?: string | null;
};

type FinderClinicLocationBlockProps = {
  district: string;
  /** Street / clinic address in plain text when available (fallback for single-clinic). */
  address?: string | null;
  /** Google Maps URL for the listing location (fallback for single-clinic). */
  addressMapsLink?: string | null;
  /** @deprecated Prefer `clinics` — kept for registered/single-clinic callers. */
  clinic?: FinderClinicRef | null;
  /** All clinics this professional practices at (interlinking). */
  clinics?: readonly FinderClinicRef[] | null;
  /**
   * `full` — profile landing: show every clinic with a quiet "N clinics" label.
   * `compact` — finder cards: primary only + “+N more clinic(s)” when multi.
   */
  variant?: "full" | "compact";
  /** Where “+N more clinic(s)” navigates (usually the professional landing). */
  moreClinicsHref?: string | null;
};

function ClinicEntry({
  item,
  district,
  fallbackAddress,
  fallbackMaps,
  useFallback,
}: {
  item: FinderClinicRef;
  district: string;
  fallbackAddress: string;
  fallbackMaps: string | null;
  useFallback: boolean;
}) {
  const clinicHref = item.slug ? clinicLandingPath(item.slug) : null;
  const addressText =
    String(item.address ?? "").trim() || (useFallback ? fallbackAddress : "");
  const locationLine = addressText || String(item.district ?? "").trim() || district;
  const mapsHref =
    String(item.addressMapsLink ?? "").trim() || (useFallback ? fallbackMaps : null);

  return (
    <div>
      {clinicHref ? (
        <PendingLink
          href={clinicHref}
          navigationReason="profile"
          prefetch={false}
          className="mb-1 block text-sm font-semibold leading-snug text-ink-800 transition-none hover:text-clinical-600"
        >
          {item.name}
        </PendingLink>
      ) : (
        <p className="mb-1 text-sm font-semibold leading-snug text-ink-800">{item.name}</p>
      )}
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

/**
 * Location block for manual finder / landing cards.
 * Shows linked clinic(s) with address + Maps CTA; compact mode collapses extras.
 */
export function FinderClinicLocationBlock({
  district,
  address,
  addressMapsLink,
  clinic = null,
  clinics = null,
  variant = "full",
  moreClinicsHref = null,
}: FinderClinicLocationBlockProps) {
  const list: FinderClinicRef[] =
    clinics && clinics.length > 0 ? [...clinics] : clinic ? [clinic] : [];

  const fallbackAddress = String(address ?? "").trim();
  const fallbackMaps = String(addressMapsLink ?? "").trim() || null;

  if (list.length === 0) {
    const locationLine = fallbackAddress || district;
    return (
      <div>
        <p className="text-xs leading-relaxed text-ink-600 whitespace-pre-wrap break-words">
          {locationLine}
        </p>
        {fallbackMaps ? (
          <a
            href={fallbackMaps}
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

  const showCompactExtras = variant === "compact" && list.length > 1;
  const visible = showCompactExtras ? list.slice(0, 1) : list;
  const extraCount = showCompactExtras ? list.length - 1 : 0;
  const moreHref = String(moreClinicsHref ?? "").trim() || null;
  const countLabel = list.length > 1 ? formatClinicCountLabel(list.length) : null;

  return (
    <div className="space-y-3">
      {variant === "full" && countLabel ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
          {countLabel}
        </p>
      ) : null}
      {visible.map((item, index) => (
        <ClinicEntry
          key={`${item.slug}-${index}`}
          item={item}
          district={district}
          fallbackAddress={fallbackAddress}
          fallbackMaps={fallbackMaps}
          useFallback={index === 0}
        />
      ))}
      {extraCount > 0 ? (
        moreHref ? (
          <PendingLink
            href={moreHref}
            navigationReason="profile"
            prefetch={false}
            className="inline-flex text-xs font-semibold text-clinical-700 transition-none underline-offset-2 hover:text-clinical-600 hover:underline"
          >
            {formatMoreClinicsLabel(extraCount)}
          </PendingLink>
        ) : (
          <p className="text-xs font-semibold text-ink-500">{formatMoreClinicsLabel(extraCount)}</p>
        )
      ) : null}
    </div>
  );
}
