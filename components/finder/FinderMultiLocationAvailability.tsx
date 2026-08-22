import type { ReactNode } from "react";
import {
  FINDER_LOCATION_CALENDAR_DIVIDER_TEST_ID,
  finderLandingCardDetailsGridClass,
  finderMultiLocationRowClass,
  finderRegisteredCardDetailsGridClass,
} from "@/components/finder/finder-availability-layout";

export type FinderMultiLocationRow = {
  key: string;
  location: ReactNode;
  calendar: ReactNode;
};

type Props = {
  rows: readonly FinderMultiLocationRow[];
  /** Finder results use `sm`; professional landing is narrower and waits for `lg`. */
  variant?: "finder" | "landing";
  countLabel?: string | null;
};

/**
 * Stacks location + calendar pairs. A subtle grey divider appears between
 * rows when a professional practices at more than one place.
 */
export function FinderMultiLocationAvailability({
  rows,
  variant = "finder",
  countLabel = null,
}: Props) {
  if (rows.length === 0) return null;

  const gridClass =
    variant === "landing"
      ? finderLandingCardDetailsGridClass
      : finderRegisteredCardDetailsGridClass;

  return (
    <div className="min-w-0 overflow-visible" data-testid="finder-multi-location-availability">
      {countLabel ? (
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
          {countLabel}
        </p>
      ) : null}
      {rows.map((row, index) => {
        const dividerClass = finderMultiLocationRowClass(index);
        return (
          <div
            key={row.key}
            className={dividerClass}
            data-testid={dividerClass ? FINDER_LOCATION_CALENDAR_DIVIDER_TEST_ID : undefined}
          >
            <div className={gridClass}>
              <div className="min-w-0">{row.location}</div>
              <div className="min-w-0 overflow-visible">{row.calendar}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
