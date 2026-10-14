"use client";

import * as React from "react";
import { PendingLink } from "@/components/navigation/PendingLink";
import { requestProfileDaySelect } from "@/lib/public/profile-day-select";

export type ProfileClinicChooserRow = {
  id: string;
  title: string;
  place: string | null;
  selected: boolean;
  /** False: online booking is off there. */
  bookable: boolean;
  /** Next free time, already worded for the locale ("Wed 14 Oct", "09:00"). */
  day: string | null;
  time: string | null;
  /** yyyy-MM-dd and the slot's key, for the chosen clinic's row. */
  dateKey: string | null;
  slotKey: string | null;
  href: string;
};

type Props = {
  rows: readonly ProfileClinicChooserRow[];
  labels: {
    title: string;
    nextFree: string;
    callToBook: string;
    noTimes: string;
  };
};

const ROW_CLASS =
  "grid h-full w-full grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * "Choose a clinic" at the top of the booking column (user, 2026-10-13): every clinic of
 * hers as one choice, drawn like radio buttons so it reads as "pick one", each with its
 * next free time. All rows share the height of the tallest. Choosing a clinic loads the
 * page for it (`?location=`), with its next free time picked in the calendar below; the
 * chosen clinic's own row goes back to that time. Nothing with a single clinic.
 */
export function ProfileClinicChooser({ rows, labels }: Props) {
  if (rows.length < 2) return null;

  return (
    <nav aria-labelledby="profile-clinic-chooser-heading" data-testid="profile-clinic-chooser">
      <h2
        id="profile-clinic-chooser-heading"
        className="mb-2 text-base font-semibold text-profile-text"
      >
        {labels.title}
      </h2>
      <ul className="grid auto-rows-fr gap-2">
        {rows.map((row) => {
          const body = (
            <>
              <span
                aria-hidden
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  row.selected ? "border-accent" : "border-profile-muted"
                }`}
              >
                {row.selected ? <span className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold leading-snug text-profile-text">
                  {row.title}
                </span>
                {row.place ? (
                  <span className="block text-xs font-medium text-profile-muted">{row.place}</span>
                ) : null}
              </span>
              <span className="w-[5.5rem] text-right">
                {row.day ? (
                  <>
                    <span className="block text-[11px] font-semibold text-profile-muted">
                      {labels.nextFree}
                    </span>
                    <span className="block text-sm font-bold text-profile-text">{row.day}</span>
                    <span className="block text-xs font-semibold tabular-nums text-accent-link">
                      {row.time}
                    </span>
                  </>
                ) : (
                  <span className="block text-xs font-bold text-profile-muted">
                    {row.bookable ? labels.noTimes : labels.callToBook}
                  </span>
                )}
              </span>
            </>
          );
          return (
            <li key={row.id} data-testid="profile-clinic-option" data-location={row.id} data-date={row.dateKey ?? undefined}>
              {row.selected ? (
                <button
                  type="button"
                  aria-current="true"
                  onClick={() => {
                    if (row.dateKey) requestProfileDaySelect(row.dateKey, row.slotKey);
                  }}
                  className={`${ROW_CLASS} border-accent bg-accent-soft`}
                >
                  {body}
                </button>
              ) : (
                <PendingLink
                  href={row.href}
                  scroll={false}
                  fill
                  className="h-full w-full rounded-2xl"
                >
                  <span className={`${ROW_CLASS} border-profile-border bg-profile-surface hover:border-accent`}>
                    {body}
                  </span>
                </PendingLink>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
