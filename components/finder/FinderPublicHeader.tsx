"use client";

import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { FinderHeadline } from "@/components/finder/FinderHeadline";
import { PendingLink } from "@/components/navigation/PendingLink";
import { useDoctorSession } from "@/components/navigation/DoctorSessionProvider";
import { SiteSchemeToggle, type SiteSchemeLabels } from "@/components/site/SiteSchemeToggle";
import type { ProfileScheme } from "@/lib/profile-scheme";

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
  /** The loading screen draws the headline's swoosh in. */
  drawSwoosh?: boolean;
};

/**
 * Public chrome for the Finder, Clinics, clinic pages, profiles and the sales page.
 * Every page but the sales one opens with R3's top strip (user, 2026-10-17): the logo in
 * the far left corner, "Are you a healthcare professional?" and Professional login on the
 * right. The Finder adds the headline in the middle and its search row below; elsewhere the
 * Light / Dark icons sit in the strip. Signed-in professionals see no guest links.
 */
export function FinderPublicHeader({
  proSessionHint = false,
  variant = "finder",
  embedded = false,
  scheme,
  schemeLabels,
  search,
  drawSwoosh = false,
}: FinderPublicHeaderProps) {
  const { sessionState, showProChrome } = useDoctorSession();
  const hideGuestCtas = sessionState.isLoggedIn || proSessionHint || showProChrome;
  const isSales = variant === "sales";
  const showGuestNav = !isSales && !hideGuestCtas;

  // Bigger on the public pages so the brand stands out (user, 2026-10-17).
  const logoSize = isSales ? "xl" : "lg";
  // On a dark page the reverse artwork (white "my"), as on the dashboard. The mode
  // switches without a reload, so CSS picks the artwork.
  const logo = (
    <>
      <DocCyWordmark variant="light" size={logoSize} className="[.doccy-profile[data-scheme=dark]_&]:hidden" />
      <DocCyWordmark variant="dark" size={logoSize} className="hidden [.doccy-profile[data-scheme=dark]_&]:inline-flex" />
    </>
  );

  if (isSales) {
    return (
      <header
        data-testid="sales-public-header"
        className={embedded ? "" : "mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8"}
      >
        <span className="inline-flex shrink-0">{logo}</span>
      </header>
    );
  }

  if (search) {
    // Mockup R3 (user, 2026-10-16/17). Below xl the headline takes its own line and the
    // question moves down beside the Light / Dark switch.
    return (
      <header data-testid="finder-public-header" className="relative z-30">
        <FinderTopStrip
          logo={logo}
          headline={<FinderHeadline drawSwoosh={drawSwoosh} />}
          showGuestNav={showGuestNav}
          askClassName="hidden xl:inline"
        />
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

  // Profiles, listings, Clinics and clinic pages: the strip alone, the switch inside it.
  return (
    <header data-testid="finder-public-header" className="relative z-30">
      <FinderTopStrip
        logo={logo}
        showGuestNav={showGuestNav}
        askClassName="hidden md:inline"
        trailing={
          scheme ? <SiteSchemeToggle initial={scheme} labels={schemeLabels} iconsOnly /> : null
        }
      />
    </header>
  );
}

/** R3's pale-teal strip: logo left, the optional headline in the middle, the way in right. */
function FinderTopStrip({
  logo,
  headline,
  showGuestNav,
  askClassName,
  trailing,
}: {
  logo: React.ReactNode;
  headline?: React.ReactNode;
  showGuestNav: boolean;
  askClassName: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div data-testid="finder-top-strip" className="bg-[#E3F4F6] [.doccy-profile[data-scheme=dark]_&]:bg-[#0B1D38]">
      <div
        className={
          headline
            ? "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-6 gap-y-2.5 px-4 pb-3.5 pt-2.5 [grid-template-areas:'logo_pro'_'claim_claim'] sm:px-6 xl:grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] xl:py-3.5 xl:[grid-template-areas:'logo_claim_pro']"
            : "flex items-center justify-between gap-4 px-4 py-2.5 sm:px-6 xl:py-3"
        }
      >
        <PendingLink
          href="/"
          aria-label="DocCy home"
          className="inline-flex min-w-0 justify-self-start transition [grid-area:logo] hover:opacity-90"
        >
          {logo}
        </PendingLink>
        {headline ? <div className="min-w-0 [grid-area:claim]">{headline}</div> : null}
        {showGuestNav || trailing ? (
          <div className="flex shrink-0 items-center gap-3 justify-self-end [grid-area:pro] sm:gap-4">
            {showGuestNav ? (
              <nav aria-label="For healthcare professionals" className="flex items-center gap-4">
                <PendingLink href="/for-professionals" className={`${askLinkClass} ${askClassName}`}>
                  Are you a healthcare professional?
                </PendingLink>
                <PendingLink href="/login" className={stripLoginClass}>
                  Professional login
                </PendingLink>
              </nav>
            ) : null}
            {trailing}
          </div>
        ) : null}
      </div>
    </div>
  );
}
