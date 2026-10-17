"use client";

import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { FinderHeadline } from "@/components/finder/FinderHeadline";
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

// R3's strip (user, 2026-10-16/17): the question as an underlined link, the login outlined.
const askLinkClass =
  "whitespace-nowrap rounded text-[13px] font-semibold text-[#0B2236] underline decoration-[#9CCFD4] underline-offset-[3px] transition hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 [.doccy-profile[data-scheme=dark]_&]:text-[#E2E8F0] [.doccy-profile[data-scheme=dark]_&]:decoration-[#4B6A92] xl:text-sm";

const stripLoginClass =
  "inline-flex min-h-[30px] items-center whitespace-nowrap rounded-lg border border-[#14B8A6] bg-site-white px-3 text-[13px] font-bold text-[#0A6B72] transition hover:bg-[#F0FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 [.doccy-profile[data-scheme=dark]_&]:border-[#3A5B87] [.doccy-profile[data-scheme=dark]_&]:bg-transparent [.doccy-profile[data-scheme=dark]_&]:text-[#7FE6EB] [.doccy-profile[data-scheme=dark]_&]:hover:bg-[#11264A] xl:text-sm";

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
  /** The Finder's search: the strip with the headline above, the search row below (mockup R3). */
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

  if (search) {
    // Mockup R3 (user, 2026-10-16/17). The strip: the logo in the far left corner, the
    // headline in the middle, the professionals' way in on the right. Below xl the headline
    // takes its own line and the question moves down beside the Light / Dark switch.
    return (
      <header data-testid="finder-public-header" className="relative z-30">
        <div data-testid="finder-top-strip" className="bg-[#E3F4F6] [.doccy-profile[data-scheme=dark]_&]:bg-[#0B1D38]">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-6 gap-y-2.5 px-4 pb-3.5 pt-2.5 [grid-template-areas:'logo_pro'_'claim_claim'] sm:px-6 xl:grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] xl:py-3.5 xl:[grid-template-areas:'logo_claim_pro']">
            <PendingLink
              href="/"
              aria-label="DocCy home"
              className="inline-flex min-w-0 justify-self-start transition [grid-area:logo] hover:opacity-90"
            >
              {logo}
            </PendingLink>
            <div className="min-w-0 [grid-area:claim]">
              <FinderHeadline />
            </div>
            {showGuestNav ? (
              <nav
                aria-label="For healthcare professionals"
                className="flex shrink-0 items-center gap-4 justify-self-end [grid-area:pro]"
              >
                <PendingLink href="/for-professionals" className={`${askLinkClass} hidden xl:inline`}>
                  Are you a healthcare professional?
                </PendingLink>
                <PendingLink href="/login" className={stripLoginClass}>
                  Professional login
                </PendingLink>
              </nav>
            ) : null}
          </div>
        </div>
        <div className="border-b border-site-ink-200 bg-site-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 pb-3.5 pt-3 sm:px-6 lg:px-8 md:py-3">
            <div
              data-testid="finder-header-search-slot"
              className="order-3 min-w-0 basis-full md:order-1 md:max-w-[760px] md:flex-1 md:basis-0"
            >
              {search}
            </div>
            {showGuestNav ? (
              <span data-testid="finder-row-ask" className="order-1 md:order-2 xl:hidden">
                <PendingLink href="/for-professionals" className={askLinkClass}>
                  Are you a healthcare professional?
                </PendingLink>
              </span>
            ) : null}
            {scheme ? (
              <div className="order-2 ml-auto md:order-3">
                <SiteSchemeToggle initial={scheme} labels={schemeLabels} iconsOnly />
              </div>
            ) : null}
          </div>
        </div>
      </header>
    );
  }

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
      </div>
    </header>
  );
}
