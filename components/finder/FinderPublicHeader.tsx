"use client";

import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { PendingLink } from "@/components/navigation/PendingLink";
import { useDoctorSession } from "@/components/navigation/DoctorSessionProvider";

// Patients are the main audience: the professional links stay quieter than the search
// (user, 2026-10-15). Login is a plain link, Join an outlined button.
const loginLinkClass =
  "inline-flex min-h-8 items-center whitespace-nowrap rounded-lg px-2 text-sm font-semibold leading-none text-ink-600 transition hover:text-clinical-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50";

const joinLinkClass =
  "inline-flex min-h-8 items-center whitespace-nowrap rounded-lg border border-clinical-500 bg-white px-2.5 text-[13px] font-semibold leading-none text-clinical-800 transition hover:bg-clinical-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50 sm:px-3 sm:text-sm";

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
 * Desktop: Professional Login + Join (space for both).
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

  const logoSize = isSales ? "xl" : "md";
  // On a public profile in dark mode the bar is dark: the reverse artwork (white "my"),
  // as on the dashboard. The mode switches without a reload, so CSS picks the artwork.
  const logo = (
    <>
      <DocCyWordmark variant="light" size={logoSize} className="[.doccy-profile[data-scheme=dark]_&]:hidden" />
      <DocCyWordmark variant="dark" size={logoSize} className="hidden [.doccy-profile[data-scheme=dark]_&]:inline-flex" />
    </>
  );

  return (
    <header
      data-testid={isSales ? "sales-public-header" : "finder-public-header"}
      className={embedded ? "" : "mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8"}
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
              Professional Login
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
