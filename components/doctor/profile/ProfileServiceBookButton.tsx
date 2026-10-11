"use client";

import { requestProfileServiceSelect } from "@/lib/public/profile-booking-events";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";

/**
 * "Book" next to a service (as on Doctolib and Zocdoc): jumps to the booking calendar with that
 * service already chosen in the details form. A plain `#book` link without JavaScript.
 */
export function ProfileServiceBookButton({
  serviceId,
  serviceName,
  label,
  ariaLabel,
}: {
  serviceId: string;
  serviceName: string;
  label: string;
  /** e.g. "Book facial laser" (the visible label stays short). */
  ariaLabel: string;
}) {
  return (
    <a
      href={`#${PROFILE_SECTION_IDS.book}`}
      onClick={() => requestProfileServiceSelect(serviceId)}
      aria-label={ariaLabel}
      data-testid="profile-service-book"
      data-service-name={serviceName}
      className="inline-flex min-h-9 shrink-0 items-center rounded-xl border-2 border-accent-soft px-3 text-sm font-bold text-accent-link transition hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {label}
    </a>
  );
}
