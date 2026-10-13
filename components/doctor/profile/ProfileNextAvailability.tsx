"use client";

import Link from "next/link";
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { requestProfileDaySelect } from "@/lib/public/profile-day-select";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";

export type ProfileNextAvailabilityLabels = {
  title: string;
  liveToday: string;
  cta: string;
  /** A bookable clinic with no free time in its horizon. */
  noTimes: string;
  none: string;
  noneHint: string;
};

export type ProfileNextAvailabilityRow = {
  locationId: string;
  title: string;
  place: string | null;
  /** The clinic the calendar below is showing. */
  selected: boolean;
  /** First day with a free time, null when there is none. */
  dateKey: string | null;
  /** That first free time (`YYYY-MM-DDTHH:mm`): the row opens the details form for it. */
  slotKey: string | null;
  isToday: boolean;
  /** Localised "Wed 14 Oct · 09:00" / "Today · 14:00", null when there is none. */
  when: string | null;
  /** `#book` for the chosen clinic, the page for that clinic otherwise. */
  href: string;
};

type Props = {
  rows: readonly ProfileNextAvailabilityRow[];
  /** A clinic phone exists in "Clinics & contact", so "call instead" can point there. */
  canCallClinic: boolean;
  labels: ProfileNextAvailabilityLabels;
};

const ROW_CLASS =
  "profile-rise flex min-h-[60px] items-center gap-3 rounded-2xl border-2 border-profile-border bg-profile-surface px-3 py-2 text-profile-text transition hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * Hero card: one row per clinic that takes online bookings, with its next free
 * time. A row opens the details form for that clinic and time (#book); for the
 * clinic already chosen it does so without reloading.
 */
export function ProfileNextAvailability({ rows, canCallClinic, labels }: Props) {
  // The one pulsing dot on the page, and only when it is true right now.
  const liveToday = rows.some((row) => row.isToday);

  return (
    <div
      data-testid="profile-next-availability"
      className="flex flex-col gap-3 rounded-3xl bg-profile-surface p-4 text-profile-body shadow-lg shadow-black/5 sm:p-5"
    >
      <h2 className="text-base font-extrabold text-profile-text">{labels.title}</h2>

      {liveToday ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-profile-text">
          <span className="profile-live-dot text-emerald-500" aria-hidden />
          {labels.liveToday}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <>
          <ul className="flex flex-col gap-2">
            {rows.map((row, index) => {
              const body = (
                <>
                  {/* The name gets the full width (clinic names are long); the place
                      and the time share the line below. */}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold leading-snug">{row.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-xs font-medium text-profile-muted">{row.place}</span>
                      <span
                        className={`text-sm ${
                          row.when ? "font-bold text-accent-link" : "font-medium text-profile-muted"
                        }`}
                      >
                        {row.when ?? labels.noTimes}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-profile-muted" aria-hidden />
                </>
              );
              const shared = {
                "data-testid": "profile-next-availability-day",
                "data-location": row.locationId,
                "data-date": row.dateKey ?? undefined,
                style: { "--rise-i": index } as React.CSSProperties,
                className: ROW_CLASS,
              };
              return (
                <li key={row.locationId}>
                  {row.selected ? (
                    <a
                      {...shared}
                      href={row.href}
                      onClick={() => {
                        if (row.dateKey) requestProfileDaySelect(row.dateKey, row.slotKey);
                      }}
                    >
                      {body}
                    </a>
                  ) : (
                    // Another clinic: the page loads for it, with the time in the link.
                    <Link {...shared} href={row.href}>
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          <a
            href={`#${PROFILE_SECTION_IDS.book}`}
            className="flex min-h-[52px] items-center justify-center rounded-2xl bg-accent-cta px-5 text-base font-extrabold text-accent-on-cta transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {labels.cta}
          </a>
        </>
      ) : (
        <div className="rounded-2xl bg-profile-bg px-4 py-3">
          <p className="text-sm font-semibold text-profile-text">{labels.none}</p>
          {canCallClinic ? (
            <a
              href={`#${PROFILE_SECTION_IDS.clinics}`}
              className="mt-1 inline-block text-sm font-semibold text-accent-link underline-offset-2 hover:underline"
            >
              {labels.noneHint}
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
