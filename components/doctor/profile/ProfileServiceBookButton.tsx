"use client";

import type { ReactNode } from "react";
import { requestProfileServiceSelect } from "@/lib/public/profile-booking-events";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";

/**
 * A row of "Services & prices" (user, 2026-10-14): the whole row is the link. It jumps to the
 * booking calendar with that service already chosen in the details form; a plain `#book`
 * link without JavaScript. Its arrow becomes "Book" on hover or keyboard focus.
 */
export function ProfileServiceBookButton({
  serviceId,
  serviceName,
  label,
  ariaLabel,
  children,
}: {
  serviceId: string;
  serviceName: string;
  label: string;
  /** e.g. "Book facial laser" (the visible label stays short). */
  ariaLabel: string;
  /** The row: name, price, arrow. */
  children: ReactNode;
}) {
  return (
    <a
      href={`#${PROFILE_SECTION_IDS.book}`}
      onClick={() => requestProfileServiceSelect(serviceId)}
      aria-label={ariaLabel}
      data-testid="profile-service-book"
      data-service-name={serviceName}
      className="group/service flex min-h-14 items-center gap-4 px-5 py-3.5 transition hover:bg-accent-soft focus:outline-none focus-visible:bg-accent-soft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
    >
      {children}
      <span
        aria-hidden
        className="hidden shrink-0 text-sm font-bold text-accent-link group-hover/service:inline group-focus-visible/service:inline"
      >
        {label}
      </span>
    </a>
  );
}
