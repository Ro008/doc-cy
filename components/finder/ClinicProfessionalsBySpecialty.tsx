"use client";

import { useMemo, useState } from "react";
import { GesyProviderBadge } from "@/components/brand/GesyProviderBadge";
import { FinderSpecialtyPills } from "@/components/finder/FinderSpecialtyPills";
import { PendingLink } from "@/components/navigation/PendingLink";
import {
  clinicRosterSpecialtyKeys,
  filterClinicRosterBySpecialty,
  splitClinicRosterByFinderVisibility,
  uniqueClinicRosterProfessionals,
} from "@/lib/clinic-roster";
import type { ClinicLandingProfessional } from "@/lib/load-clinic-by-slug";
import {
  finderCardImagePriority,
  type FinderCardImagePriority,
} from "@/lib/finder-card-image-priority";

/** Unique specialty chips with how many distinct professionals have that specialty. */
function buildSpecialtyChipCounts(
  professionals: ClinicLandingProfessional[],
): Array<{ specialty: string; count: number }> {
  const counts = new Map<string, number>();
  for (const pro of professionals) {
    for (const key of clinicRosterSpecialtyKeys(pro)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b, "en", { sensitivity: "base" }))
    .map(([specialty, count]) => ({ specialty, count }));
}

/** Interactive card: open profile / specialty finder. */
function BookableProfessionalCard({
  pro,
  imagePriority,
}: {
  pro: ClinicLandingProfessional;
  imagePriority: FinderCardImagePriority;
}) {
  const photo = (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-clinical-200 bg-ink-50">
      <img
        src={pro.photoUrl}
        alt=""
        className="h-full w-full object-cover"
        {...imagePriority}
      />
    </div>
  );

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition-none hover:border-clinical-300 hover:shadow-md">
      {pro.profileHref ? (
        <PendingLink
          href={pro.profileHref}
          navigationReason="profile"
          fill
          prefetch={false}
          className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-clinical-200 bg-ink-50 transition-none hover:border-clinical-300"
        >
          <img
            src={pro.photoUrl}
            alt=""
            className="h-full w-full object-cover"
            {...imagePriority}
          />
        </PendingLink>
      ) : (
        photo
      )}
      <div className="min-w-0 flex-1">
        {pro.profileHref ? (
          <PendingLink
            href={pro.profileHref}
            navigationReason="profile"
            prefetch={false}
            className="font-semibold text-ink-900 transition-none hover:text-clinical-700"
          >
            {pro.displayName}
          </PendingLink>
        ) : (
          <p className="font-semibold text-ink-900">{pro.displayName}</p>
        )}
        <div className="mt-0.5">
          <FinderSpecialtyPills
            specialties={pro.specialties}
            specialty={pro.specialty}
            district={pro.district}
          />
        </div>
        {pro.isGesy ? (
          <div className="mt-2">
            <GesyProviderBadge size="xs" language="en" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Inpatient-only row: informational, not a destination.
 * Dense list pattern (directory “also on staff”) — no hover, links, or card chrome that
 * competes with bookable profile cards above.
 */
function InpatientProfessionalRow({ pro }: { pro: ClinicLandingProfessional }) {
  const specialtyLabels = (
    pro.specialties.length > 0 ? pro.specialties : [pro.specialty]
  )
    .map((s) => String(s ?? "").trim())
    .filter(Boolean);

  return (
    <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-ink-200 bg-ink-100">
        <img
          src={pro.photoUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-sm font-medium text-ink-800">{pro.displayName}</p>
          {pro.isGesy ? <GesyProviderBadge size="xs" language="en" /> : null}
        </div>
        {specialtyLabels.length > 0 ? (
          <p className="mt-0.5 truncate text-xs text-ink-500">
            {specialtyLabels.join(" · ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Clinic roster: bookable professionals first (interactive cards), then inpatient-only
 * as a secondary informational list — different job, so different pattern.
 */
export function ClinicProfessionalsBySpecialty({
  professionals,
}: {
  professionals: ClinicLandingProfessional[];
}) {
  const uniqueProfessionals = useMemo(
    () => uniqueClinicRosterProfessionals(professionals),
    [professionals],
  );

  const { bookable, inpatientOnly } = useMemo(
    () => splitClinicRosterByFinderVisibility(uniqueProfessionals),
    [uniqueProfessionals],
  );

  // Specialty filters apply only to bookable people (the actionable list).
  const specialtyChips = useMemo(
    () => buildSpecialtyChipCounts(bookable),
    [bookable],
  );
  const showChips = specialtyChips.length > 1;
  const [activeSpecialty, setActiveSpecialty] = useState<string | null>(null);

  const visibleBookable = useMemo(
    () => filterClinicRosterBySpecialty(bookable, activeSpecialty),
    [activeSpecialty, bookable],
  );

  if (uniqueProfessionals.length === 0) {
    return (
      <p className="mt-3 text-sm text-ink-500">
        No professionals linked to this clinic yet.
      </p>
    );
  }

  const bookableCountLabel =
    visibleBookable.length === 1
      ? "1 professional"
      : `${visibleBookable.length} professionals`;

  const inpatientCountLabel =
    inpatientOnly.length === 1
      ? "1 professional"
      : `${inpatientOnly.length} professionals`;

  return (
    <div className="mt-4 space-y-8">
      {bookable.length > 0 ? (
        <div>
          {showChips ? (
            <div
              className="mb-5 flex flex-wrap gap-2"
              role="toolbar"
              aria-label="Filter by specialty"
            >
              <button
                type="button"
                onClick={() => setActiveSpecialty(null)}
                aria-pressed={activeSpecialty === null}
                className={
                  activeSpecialty === null
                    ? "rounded-full border border-clinical-500 bg-clinical-50 px-3 py-1.5 text-xs font-semibold text-clinical-800"
                    : "rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-clinical-300 hover:bg-clinical-50"
                }
              >
                All ({bookable.length})
              </button>
              {specialtyChips.map((chip) => (
                <button
                  key={chip.specialty}
                  type="button"
                  onClick={() => setActiveSpecialty(chip.specialty)}
                  aria-pressed={activeSpecialty === chip.specialty}
                  className={
                    activeSpecialty === chip.specialty
                      ? "rounded-full border border-clinical-500 bg-clinical-50 px-3 py-1.5 text-xs font-semibold text-clinical-800"
                      : "rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-clinical-300 hover:bg-clinical-50"
                  }
                >
                  {chip.specialty} ({chip.count})
                </button>
              ))}
            </div>
          ) : null}

          <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-ink-200 pb-2">
            <h3 className="text-sm font-bold tracking-wide text-ink-900">
              {activeSpecialty ?? "All professionals"}
            </h3>
            <p className="shrink-0 text-xs font-medium text-ink-500">{bookableCountLabel}</p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {visibleBookable.map((pro, index) => (
              <li key={pro.id}>
                <BookableProfessionalCard
                  pro={pro}
                  imagePriority={finderCardImagePriority(index)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {inpatientOnly.length > 0 ? (
        <section aria-labelledby="clinic-inpatient-heading">
          <div className="mb-3 border-b border-ink-200 pb-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3
                id="clinic-inpatient-heading"
                className="text-sm font-bold tracking-wide text-ink-900"
              >
                Inpatient services
              </h3>
              <p className="shrink-0 text-xs font-medium text-ink-500">{inpatientCountLabel}</p>
            </div>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-ink-500">
              Hospital inpatient care at this clinic. These professionals do not have a public
              DocCy profile or online booking.
            </p>
          </div>

          <ul className="overflow-hidden rounded-2xl border border-ink-200 bg-ink-50/60 divide-y divide-ink-200">
            {inpatientOnly.map((pro) => (
              <li key={pro.id}>
                <InpatientProfessionalRow pro={pro} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
