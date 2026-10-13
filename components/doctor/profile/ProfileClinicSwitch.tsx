"use client";

import * as React from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { PendingLink } from "@/components/navigation/PendingLink";
import { HideWhileBookingDetails } from "@/components/doctor/profile/HideWhileBookingDetails";
import type { ClinicSwitchOption } from "@/lib/public/profile-clinic-availability";

type Props = {
  current: { title: string; place: string | null } | null;
  others: readonly ClinicSwitchOption[];
  labels: {
    bookingAt: string;
    chooseClinic: string;
    changeClinic: string;
    bookingOff: string;
  };
};

/**
 * Above the calendar: the clinic being booked and a small "Change clinic"
 * control. The hero's next-availability rows are the main way to choose a
 * clinic; this is for a patient who is already at the calendar. Nothing with a
 * single clinic. The page keys it by the chosen clinic, so it closes on a switch.
 */
export function ProfileClinicSwitch({ current, others, labels }: Props) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  if (others.length === 0) return null;

  return (
    <HideWhileBookingDetails
      className="mb-4 rounded-3xl border border-profile-border bg-profile-surface px-4 py-3 text-profile-body sm:px-5"
      data-testid="profile-clinic-picker"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="flex min-w-0 items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-link" aria-hidden />
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-profile-muted">
              {current ? labels.bookingAt : labels.chooseClinic}
            </span>
            {current ? (
              <span data-testid="profile-clinic-current" className="block text-sm text-profile-muted">
                <span className="font-extrabold text-profile-text">{current.title}</span>
                {current.place ? ` · ${current.place}` : ""}
              </span>
            ) : null}
          </span>
        </p>
        <button
          type="button"
          data-testid="profile-clinic-change"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-profile-border px-4 text-sm font-bold text-profile-text transition hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {labels.changeClinic}
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>
      {/* A class, not the `hidden` attribute: `grid` would win over it. */}
      <ul id={listId} className={open ? "mt-3 grid gap-2 sm:grid-cols-2" : "hidden"}>
        {others.map((clinic) => (
          <li key={clinic.id}>
            <PendingLink
              href={clinic.href}
              scroll={false}
              fill
              className="h-full w-full rounded-2xl border-2 border-profile-border bg-profile-surface px-3 py-2 text-left transition hover:border-accent"
            >
              <span className="block w-full text-left">
                <span className="block text-sm font-extrabold leading-snug text-profile-text">
                  {clinic.title}
                </span>
                <span className="block text-xs font-medium text-profile-muted">
                  {[clinic.place, clinic.bookable ? null : labels.bookingOff].filter(Boolean).join(" · ")}
                </span>
              </span>
            </PendingLink>
          </li>
        ))}
      </ul>
    </HideWhileBookingDetails>
  );
}
