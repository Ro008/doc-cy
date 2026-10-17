import type { CSSProperties } from "react";

import { finderResultCardClass } from "@/components/finder/finder-surface";
import {
  finderProfileCardBodyClass,
  finderProfileCardClass,
} from "@/components/finder/finder-availability-layout";

type FinderResultsListSkeletonProps = {
  count?: number;
  /** `professionals` = today's Finder cards (mockup O); `clinics` = the Clinics tab's rows. */
  variant?: "professionals" | "clinics";
};

// Placeholder shapes on the card, and the slightly darker ones on the pale profile panel.
const bone = "bg-[#E4EEF1] [.doccy-profile[data-scheme=dark]_&]:bg-[#1A3156]";
const panelBone = "bg-[#D8E9EC] [.doccy-profile[data-scheme=dark]_&]:bg-[#22406B]";

/**
 * While results load (user, 2026-10-17): cards in the shape of the real ones, a soft light
 * sweeping across each in turn, the cards rising in one after another. Still when the
 * visitor asks for less motion (globals.css).
 */
export function FinderResultsListSkeleton({
  count = 4,
  variant = "professionals",
}: FinderResultsListSkeletonProps) {
  return (
    <div
      className={variant === "professionals" ? "flex flex-col gap-7" : "mt-6 flex flex-col gap-4"}
      data-testid="finder-results-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Updating results...</span>
      {Array.from({ length: count }, (_, index) =>
        variant === "professionals" ? (
          <FinderCardSkeleton key={index} index={index} />
        ) : (
          <div
            key={index}
            aria-hidden
            className={`${finderResultCardClass} finder-skeleton-shimmer finder-skeleton-card-in`}
            style={{ "--i": index } as CSSProperties}
          >
            <div className="flex items-start gap-3">
              <div className={`h-[72px] w-[72px] shrink-0 rounded-full ${bone}`} />
              <div className="min-w-0 flex-1 space-y-2 pt-1">
                <div className={`rounded-md h-4 w-2/3 ${bone}`} />
                <div className={`rounded-md h-3 w-1/3 ${bone}`} />
                <div className={`rounded-md h-3 w-1/2 ${bone}`} />
              </div>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

/** One card: the profile panel, then the week and times beside the clinic. */
function FinderCardSkeleton({ index }: { index: number }) {
  return (
    <div
      aria-hidden
      className={`${finderProfileCardClass} finder-skeleton-shimmer finder-skeleton-card-in`}
      style={{ "--i": index } as CSSProperties}
    >
      <div className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)] content-start gap-x-3 gap-y-3 rounded-[20px] bg-[#EEF6F7] p-4 [.doccy-profile[data-scheme=dark]_&]:bg-[#17335A] sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-x-5 sm:px-6 sm:py-[22px] lg:grid-cols-[72px_minmax(0,1fr)] lg:p-[22px]">
        <div className={`aspect-square w-full rounded-2xl ${panelBone}`} />
        <div className="flex min-w-0 flex-col gap-2.5 pt-1">
          <div className={`rounded-md h-5 w-4/5 ${panelBone}`} />
          <div className={`rounded-md h-3.5 w-1/2 ${panelBone}`} />
        </div>
        <div className="col-span-2 flex flex-wrap gap-2">
          <div className={`h-7 w-24 rounded-full ${panelBone}`} />
          <div className={`h-7 w-16 rounded-full ${panelBone}`} />
        </div>
        <div className="col-span-2 flex flex-col gap-2">
          <div className={`rounded-md h-3 w-3/4 ${panelBone}`} />
          <div className={`rounded-md h-3 w-2/3 ${panelBone}`} />
          <div className={`rounded-md h-3 w-1/2 ${panelBone}`} />
        </div>
      </div>

      <div className={finderProfileCardBodyClass}>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex max-w-[470px] items-end gap-1.5">
            <div className={`mb-1 h-8 w-8 shrink-0 rounded-full ${bone}`} />
            <div className="grid min-w-0 flex-1 grid-cols-7 gap-0.5">
              {Array.from({ length: 7 }, (_, day) => (
                <div key={day} className="flex flex-col items-center gap-1.5">
                  <div className={`rounded-md h-2.5 w-6 ${bone}`} />
                  <div className={`h-8 w-8 rounded-full sm:h-10 sm:w-10 ${bone}`} />
                </div>
              ))}
            </div>
            <div className={`mb-1 h-8 w-8 shrink-0 rounded-full ${bone}`} />
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {Array.from({ length: 12 }, (_, slot) => (
              <div
                key={slot}
                className={`h-9 rounded-xl ${bone} ${slot >= 8 ? "hidden sm:block" : ""}`}
              />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5 border-t border-profile-border pt-4 lg:border-t-0 lg:pt-0">
          <div className={`rounded-md h-4 w-3/4 ${bone}`} />
          <div className={`rounded-md h-3 w-full ${bone}`} />
          <div className={`rounded-md h-3 w-2/3 ${bone}`} />
          <div className="mt-1 flex flex-col gap-1.5">
            <div className={`rounded-md h-3 w-1/2 ${bone}`} />
            <div className={`rounded-md h-3 w-1/2 ${bone}`} />
          </div>
          <div className="mt-2 flex gap-2">
            <div className={`h-9 w-20 rounded-xl ${bone}`} />
            <div className={`h-9 w-32 rounded-xl ${bone}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
