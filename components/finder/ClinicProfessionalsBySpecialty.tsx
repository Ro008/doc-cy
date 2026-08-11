"use client";

import { useMemo, useState } from "react";
import { GesyProviderBadge } from "@/components/brand/GesyProviderBadge";
import { FinderSpecialtyLink } from "@/components/finder/FinderSpecialtyLink";
import { FinderSpecialtyPills } from "@/components/finder/FinderSpecialtyPills";
import { PendingLink } from "@/components/navigation/PendingLink";
import type { ClinicLandingProfessional } from "@/lib/load-clinic-by-slug";

const SPECIALTY_CHIP_THRESHOLD = 5;

type SpecialtyGroup = {
  specialty: string;
  professionals: ClinicLandingProfessional[];
};

function groupProfessionalsBySpecialty(
  professionals: ClinicLandingProfessional[],
): SpecialtyGroup[] {
  const bySpecialty = new Map<string, ClinicLandingProfessional[]>();
  for (const pro of professionals) {
    const keys =
      pro.specialties?.length > 0
        ? pro.specialties.map((s) => s.trim()).filter(Boolean)
        : [pro.specialty.trim() || "Specialty not set"];
    // Multi-specialty pros appear under each specialty chip/group.
    for (const key of keys.length > 0 ? keys : ["Specialty not set"]) {
      const list = bySpecialty.get(key);
      if (list) {
        if (!list.some((existing) => existing.id === pro.id)) list.push(pro);
      } else {
        bySpecialty.set(key, [pro]);
      }
    }
  }

  return Array.from(bySpecialty.entries())
    .sort(([a], [b]) => a.localeCompare(b, "en", { sensitivity: "base" }))
    .map(([specialty, members]) => ({
      specialty,
      professionals: [...members].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" }),
      ),
    }));
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

export function ClinicProfessionalsBySpecialty({
  professionals,
}: {
  professionals: ClinicLandingProfessional[];
}) {
  const groups = useMemo(
    () => groupProfessionalsBySpecialty(professionals),
    [professionals],
  );
  const showChips = groups.length >= SPECIALTY_CHIP_THRESHOLD;
  const [activeSpecialty, setActiveSpecialty] = useState<string | null>(null);

  const visibleGroups = useMemo(() => {
    if (!activeSpecialty) return groups;
    return groups.filter((g) => g.specialty === activeSpecialty);
  }, [activeSpecialty, groups]);

  if (professionals.length === 0) {
    return (
      <p className="mt-3 text-sm text-ink-500">
        No professionals linked to this clinic yet.
      </p>
    );
  }

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
            All ({professionals.length})
          </button>
          {groups.map((group) => (
            <button
              key={group.specialty}
              type="button"
              onClick={() => setActiveSpecialty(group.specialty)}
              aria-pressed={activeSpecialty === group.specialty}
              className={
                activeSpecialty === group.specialty
                  ? "rounded-full border border-clinical-500 bg-clinical-50 px-3 py-1.5 text-xs font-semibold text-clinical-800"
                  : "rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-clinical-300 hover:bg-clinical-50"
              }
            >
              {group.specialty} ({group.professionals.length})
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-8">
        {visibleGroups.map((group) => (
          <section
            key={group.specialty}
            aria-labelledby={`clinic-specialty-${slugifySpecialty(group.specialty)}`}
          >
            <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-ink-200 pb-2">
              <h3
                id={`clinic-specialty-${slugifySpecialty(group.specialty)}`}
                className="text-sm font-bold tracking-wide text-ink-900"
              >
                <FinderSpecialtyLink
                  specialty={group.specialty}
                  className="text-ink-900 transition-none underline-offset-2 hover:text-clinical-700 hover:underline"
                />
              </h3>
              <p className="shrink-0 text-xs font-medium text-ink-500">
                {group.professionals.length === 1
                  ? "1 professional"
                  : `${group.professionals.length} professionals`}
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {group.professionals.map((pro) => (
                <li key={pro.id}>
                  <ProfessionalCard pro={pro} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function slugifySpecialty(specialty: string): string {
  return specialty
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
