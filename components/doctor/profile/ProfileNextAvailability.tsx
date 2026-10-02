"use client";

import * as React from "react";
import {
  hasAvailabilityToday,
  type ProfileAvailabilityDay,
} from "@/lib/public/profile-next-availability";
import { requestProfileDaySelect } from "@/lib/public/profile-day-select";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";

export type ProfileNextAvailabilityLabels = {
  title: string;
  today: string;
  /** Already formatted "from {time}" for each day, keyed by dateKey. */
  fromByDate: Record<string, string>;
  /** Localised "Mon 5 Oct" for each day, keyed by dateKey. */
  dayByDate: Record<string, string>;
  liveToday: string;
  cta: string;
  none: string;
  noneHint: string;
};

type Props = {
  days: readonly ProfileAvailabilityDay[];
  clinicLabel: string | null;
  /** A clinic phone exists in "Clinics & contact", so "call instead" can point there. */
  canCallClinic: boolean;
  labels: ProfileNextAvailabilityLabels;
};

/**
 * Hero card: the next days with free times and the first time each day. A day
 * opens that day in the booking calendar (#book) without reloading.
 */
export function ProfileNextAvailability({
  days,
  clinicLabel,
  canCallClinic,
  labels,
}: Props) {
  const [picked, setPicked] = React.useState<string | null>(null);
  // The one pulsing dot on the page, and only when it is true right now.
  const liveToday = hasAvailabilityToday(days);

  return (
    <div
      data-testid="profile-next-availability"
      className="flex flex-col gap-3 rounded-3xl bg-profile-surface p-4 text-profile-body shadow-lg shadow-black/5 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-base font-extrabold text-profile-text">
          {labels.title}
        </h2>
        {clinicLabel ? (
          <span className="text-sm font-semibold text-accent-link">
            {clinicLabel}
          </span>
        ) : null}
      </div>

      {liveToday ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-profile-text">
          <span className="profile-live-dot text-emerald-500" aria-hidden />
          {labels.liveToday}
        </p>
      ) : null}

      {days.length > 0 ? (
        <>
          <ul className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
            {days.map((day, index) => {
              const selected = picked === day.dateKey;
              return (
                <li key={day.dateKey}>
                  <a
                    href={`#${PROFILE_SECTION_IDS.book}`}
                    data-testid="profile-next-availability-day"
                    data-date={day.dateKey}
                    onClick={() => {
                      setPicked(day.dateKey);
                      requestProfileDaySelect(day.dateKey);
                    }}
                    style={{ "--rise-i": index } as React.CSSProperties}
                    className={`profile-rise flex min-h-[60px] flex-col justify-center rounded-2xl border-2 px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      selected
                        ? "profile-pop border-accent-cta bg-accent-cta text-accent-on-cta"
                        : "border-profile-border bg-profile-surface text-profile-text hover:border-accent"
                    }`}
                  >
                    <span className="text-sm font-extrabold">
                      {day.isToday
                        ? labels.today
                        : labels.dayByDate[day.dateKey]}
                    </span>
                    <span className="text-xs font-medium opacity-80">
                      {labels.fromByDate[day.dateKey]}
                    </span>
                  </a>
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
          <p className="text-sm font-semibold text-profile-text">
            {labels.none}
          </p>
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
