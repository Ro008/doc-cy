import { PendingLink } from "@/components/navigation/PendingLink";
import { RevealPhoneButton } from "@/components/finder/RevealPhoneButton";
import { clinicLandingPath } from "@/lib/clinic-landing-path";
import type { CallToBookSource } from "@/lib/call-to-book";
import {
  formatClinicCountLabel,
  formatMoreClinicsLabel,
} from "@/lib/manual-directory-clinics";

export type FinderClinicRef = {
  id?: string | null;
  name: string;
  slug: string;
  address?: string | null;
  addressMapsLink?: string | null;
  district?: string | null;
  hasPhone?: boolean;
};

export type FinderCallToBookContext = {
  manualId: string;
  listingHasPhone: boolean;
  source: CallToBookSource;
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
  /** When set, each visible location gets a Call to Book CTA. */
  callToBook?: FinderCallToBookContext | null;
};

const callToBookClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-clinical-200 bg-clinical-50 px-3 py-1.5 text-xs font-semibold text-clinical-800 transition-none hover:border-clinical-300 hover:bg-clinical-100 disabled:cursor-wait disabled:opacity-60";

const callToBookRevealedClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-clinical-200 bg-clinical-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-clinical-800 transition-none hover:border-clinical-300 hover:bg-clinical-100";

function LocationCallToBook({
  item,
  callToBook,
}: {
  item?: FinderClinicRef | null;
  callToBook: FinderCallToBookContext;
}) {
  const clinicId = String(item?.id ?? "").trim() || null;
  const hasPhone = Boolean(item?.hasPhone) || callToBook.listingHasPhone;
  if (!hasPhone) return null;

  if (clinicId) {
    return (
      <RevealPhoneButton
        kind="clinic"
        id={clinicId}
        hasPhone
        variant="call-to-book"
        source={callToBook.source}
        manualId={callToBook.manualId}
        className={callToBookClass}
        revealedClassName={callToBookRevealedClass}
      />
    );
  }

  return (
    <RevealPhoneButton
      kind="manual"
      id={callToBook.manualId}
      hasPhone
      variant="call-to-book"
      source={callToBook.source}
      className={callToBookClass}
      revealedClassName={callToBookRevealedClass}
    />
  );
}

function ClinicEntry({
  item,
  district,
  fallbackAddress,
  fallbackMaps,
  useFallback,
  callToBook,
}: {
  item: FinderClinicRef;
  district: string;
  fallbackAddress: string;
  fallbackMaps: string | null;
  useFallback: boolean;
  callToBook?: FinderCallToBookContext | null;
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
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {mapsHref ? (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-xs font-semibold text-clinical-700 transition-none underline-offset-2 hover:text-clinical-600 hover:underline"
          >
            Open in Maps ↗
          </a>
        ) : null}
        {callToBook ? <LocationCallToBook item={item} callToBook={callToBook} /> : null}
      </div>
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
  callToBook = null,
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
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {fallbackMaps ? (
            <a
              href={fallbackMaps}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-xs font-semibold text-clinical-700 transition-none underline-offset-2 hover:text-clinical-600 hover:underline"
            >
              Open in Maps ↗
            </a>
          ) : null}
          {callToBook ? <LocationCallToBook callToBook={callToBook} /> : null}
        </div>
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
          key={`${item.slug}-${item.id ?? index}`}
          item={item}
          district={district}
          fallbackAddress={fallbackAddress}
          fallbackMaps={fallbackMaps}
          useFallback={index === 0}
          callToBook={callToBook}
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
