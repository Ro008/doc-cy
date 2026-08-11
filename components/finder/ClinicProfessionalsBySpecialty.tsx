"use client";

import { useMemo, useState } from "react";
import { GesyProviderBadge } from "@/components/brand/GesyProviderBadge";
import { FinderSpecialtyPills } from "@/components/finder/FinderSpecialtyPills";
import { PendingLink } from "@/components/navigation/PendingLink";
import {
  clinicRosterSpecialtyKeys,
  filterClinicRosterBySpecialty,
  uniqueClinicRosterProfessionals,
} from "@/lib/clinic-roster";
import type { ClinicLandingProfessional } from "@/lib/load-clinic-by-slug";

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

function ProfessionalCard({ pro }: { pro: ClinicLandingProfessional }) {
  const photo = (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-clinical-200 bg-ink-50">
      <img
        src={pro.photoUrl}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
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
            loading="lazy"
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
            <GesyProviderBadge size="sm" language="en" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Clinic roster: one card per professional (no multi-specialty duplicates).
 * Specialty chips filter the unique list when a clinic has more than one specialty.
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
  const specialtyChips = useMemo(
    () => buildSpecialtyChipCounts(uniqueProfessionals),
    [uniqueProfessionals],
  );
  const showChips = specialtyChips.length > 1;
  const [activeSpecialty, setActiveSpecialty] = useState<string | null>(null);

  const visibleProfessionals = useMemo(
    () => filterClinicRosterBySpecialty(uniqueProfessionals, activeSpecialty),
    [activeSpecialty, uniqueProfessionals],
  );

  if (uniqueProfessionals.length === 0) {
    return (
      <p className="mt-3 text-sm text-ink-500">
        No professionals linked to this clinic yet.
      </p>
    );
  }

  const countLabel =
    visibleProfessionals.length === 1
      ? "1 professional"
      : `${visibleProfessionals.length} professionals`;

  return (
    <div className="mt-4">
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
            All ({uniqueProfessionals.length})
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
        <p className="shrink-0 text-xs font-medium text-ink-500">{countLabel}</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {visibleProfessionals.map((pro) => (
          <li key={pro.id}>
            <ProfessionalCard pro={pro} />
          </li>
        ))}
      </ul>
    </div>
  );
}
