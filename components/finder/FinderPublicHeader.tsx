"use client";

import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { PendingLink } from "@/components/navigation/PendingLink";
import { useDoctorSession } from "@/components/navigation/DoctorSessionProvider";
import { SiteSchemeToggle, type SiteSchemeLabels } from "@/components/site/SiteSchemeToggle";
import type { ProfileScheme } from "@/lib/profile-scheme";

// Patients are the main audience: the professional links stay quieter than the search
// (user, 2026-10-15). For professionals and Professional login are plain links side by
// side (canvas comment, 2026-10-15), Join an outlined button.
const loginLinkClass =
  "inline-flex min-h-8 items-center whitespace-nowrap rounded-lg px-2 text-sm font-semibold leading-none text-site-ink-600 transition hover:text-site-clinical-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-site-ink-50";

const joinLinkClass =
  "inline-flex min-h-8 items-center whitespace-nowrap rounded-lg border border-clinical-500 bg-site-white px-2.5 text-[13px] font-semibold leading-none text-site-clinical-800 transition hover:bg-site-clinical-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-site-ink-50 sm:px-3 sm:text-sm";

type FinderPublicHeaderProps = {
  /** Server-read hint so we never paint guest CTAs for a signed-in professional. */
  proSessionHint?: boolean;
  /** Finder/clinics vs professional sales page. */
  variant?: "finder" | "sales";
  /** Skip outer padding when the parent already provides it. */
  embedded?: boolean;
  /** The page's Light / Dark mode; shows the switch. Leave out on pages with one look. */
  scheme?: ProfileScheme;
  /** The switch's words (the profile passes its translations; English otherwise). */
  schemeLabels?: SiteSchemeLabels;
  /** The Finder's search: beside the logo from xl, its own row below that (Finder G, step 2). */
  search?: React.ReactNode;
};

/**
 * Thin public chrome for finder / clinics / public profiles / sales.
 * Mobile: one acquisition CTA (Join → /register).
 * Desktop: For professionals + Professional login + Join.
 * Light / Dark switch on every page that has both looks (one choice for the whole site).
 * Signed-in professionals use the global user bar; this header stays logo-only.
 */
export function FinderPublicHeader({
  proSessionHint = false,
  variant = "finder",
  embedded = false,
  scheme,
  schemeLabels,
  search,
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

  const bar = (
    <header
      data-testid={isSales ? "sales-public-header" : "finder-public-header"}
      className={embedded ? "" : `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${search ? "py-3" : "py-2.5"}`}
    >
      <div className={`flex items-center justify-between ${search ? "flex-wrap gap-x-4 gap-y-3" : "gap-2 sm:gap-3"}`}>
        {isSales ? (
          <span className="inline-flex shrink-0">{logo}</span>
        ) : (
          <PendingLink href="/" className="inline-flex min-w-0 shrink transition hover:opacity-90">
            {logo}
          </PendingLink>
        )}
        {search ? (
          <div
            data-testid="finder-header-search-slot"
            className="order-3 min-w-0 basis-full xl:order-2 xl:flex-[999_1_480px]"
          >
            {search}
          </div>
        ) : null}
        {search ? (
          // G (user, 2026-10-16): one row with the logo and the search from xl; the switch,
          // For professionals and an outlined Professional login. No Join on the Finder.
          <div className="order-2 flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2 xl:order-3">
            {scheme ? <SiteSchemeToggle initial={scheme} labels={schemeLabels} /> : null}
            {showGuestNav ? (
              <nav aria-label="Professional access" className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
                <PendingLink href="/for-professionals" className={`${loginLinkClass} hidden md:inline-flex`}>
                  For professionals
                </PendingLink>
                <PendingLink href="/login" className={joinLinkClass}>
                  Professional login
                </PendingLink>
              </nav>
            ) : null}
          </div>
        ) : (
        <div className="order-2 flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2.5">
          {showGuestNav ? (
            <nav
              aria-label="Professional access"
              className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2.5"
            >
              <PendingLink
                href="/for-professionals"
                className={`${loginLinkClass} hidden md:inline-flex`}
              >
                For professionals
              </PendingLink>
              <PendingLink
                href="/login"
                className={`${loginLinkClass} hidden md:inline-flex`}
              >
                Professional login
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
          {scheme ? <SiteSchemeToggle initial={scheme} labels={schemeLabels} /> : null}
        </div>
        )}
      </div>
    </header>
  );

  if (!search) return bar;
  // G: the header is its own white band with the search in it.
  return <div className="relative z-30 border-b border-site-ink-200 bg-site-white">{bar}</div>;
}
