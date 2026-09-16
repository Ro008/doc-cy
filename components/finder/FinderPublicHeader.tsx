"use client";

import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { PendingLink } from "@/components/navigation/PendingLink";
import { useDoctorSession } from "@/components/navigation/DoctorSessionProvider";

const loginLinkClass =
  "inline-flex min-h-8 items-center whitespace-nowrap rounded-lg border border-ink-200 bg-white px-3 text-sm font-semibold leading-none text-ink-800 transition hover:border-clinical-300 hover:bg-clinical-50 hover:text-clinical-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50";

const joinLinkClass =
  "inline-flex min-h-8 items-center whitespace-nowrap rounded-lg border border-clinical-500 bg-clinical-500 px-2.5 text-[13px] font-semibold leading-none text-white shadow-[0_1px_2px_rgba(18,184,192,0.22)] transition hover:border-clinical-600 hover:bg-clinical-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50 sm:px-3 sm:text-sm";

type FinderPublicHeaderProps = {
  /** Server-read hint so we never paint guest CTAs for a signed-in professional. */
  proSessionHint?: boolean;
  /** Finder/clinics vs professional sales page. */
  variant?: "finder" | "sales";
  /** Skip outer padding when the parent already provides it. */
  embedded?: boolean;
};

/**
 * Thin public chrome for finder / clinics / public profiles / sales.
 * Mobile: one acquisition CTA (Join → /register).
 * Desktop: Practitioner login + Join (space for both).
 * Signed-in professionals use the global user bar; this header stays logo-only.
 */
export function FinderPublicHeader({
  proSessionHint = false,
  variant = "finder",
  embedded = false,
}: FinderPublicHeaderProps) {
  const { sessionState, showProChrome } = useDoctorSession();
  const hideGuestCtas = sessionState.isLoggedIn || proSessionHint || showProChrome;
  const isSales = variant === "sales";
  const showGuestNav = !isSales && !hideGuestCtas;

  const logo = <DocCyWordmark variant="light" size={isSales ? "xl" : "md"} />;

  return (
    <header
      data-testid={isSales ? "sales-public-header" : "finder-public-header"}
      className={embedded ? "" : "px-4 py-2.5 sm:px-6 lg:px-8"}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        {isSales ? (
          <span className="inline-flex shrink-0">{logo}</span>
        ) : (
          <PendingLink href="/" className="inline-flex min-w-0 shrink transition hover:opacity-90">
            {logo}
          </PendingLink>
        )}
        {showGuestNav ? (
          <nav
            aria-label="Professional access"
            className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2.5"
          >
            <PendingLink
              href="/login"
              className={`${loginLinkClass} hidden md:inline-flex`}
            >
              Practitioner login
            </PendingLink>
            <PendingLink
              href="/register"
              className={joinLinkClass}
              aria-label="Join as a professional"
            >
              Join as a professional
            </PendingLink>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
