"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { PendingLink } from "@/components/navigation/PendingLink";
import { useDoctorSession } from "@/components/navigation/DoctorSessionProvider";
import { FOR_PROFESSIONALS_PATH } from "@/lib/finder-public-path";

const loginLinkClass =
  "inline-flex min-h-8 items-center whitespace-nowrap rounded-md px-2.5 text-sm font-semibold leading-none text-ink-800 transition hover:bg-clinical-50 hover:text-clinical-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50";

const secondaryLinkClass =
  "inline-flex min-h-8 items-center whitespace-nowrap rounded-lg border border-clinical-400 bg-white px-3 text-sm font-semibold leading-none text-clinical-800 shadow-[0_1px_2px_rgba(18,184,192,0.12)] transition hover:border-clinical-500 hover:bg-clinical-50 hover:text-clinical-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50";

const menuLoginClass =
  "flex w-full items-center rounded-[0.9rem] px-3.5 py-2.5 text-left text-[13px] font-medium leading-snug text-ink-700 no-underline transition hover:bg-ink-50 hover:text-ink-900";

const menuSecondaryClass =
  "flex w-full items-center rounded-[0.9rem] px-3.5 py-2.5 text-left text-[13px] font-semibold leading-snug text-clinical-800 no-underline transition hover:bg-clinical-50 hover:text-clinical-900";

type FinderPublicHeaderProps = {
  /** Server-read hint so we never paint guest CTAs for a signed-in professional. */
  proSessionHint?: boolean;
  /** Finder/clinics vs professional sales page. */
  variant?: "finder" | "sales";
  /** Skip outer padding when the parent already provides it. */
  embedded?: boolean;
};

function secondaryCta(): {
  href: string;
  label: string;
  ariaLabel: string;
} {
  return {
    href: FOR_PROFESSIONALS_PATH,
    label: "Are you a healthcare professional?",
    ariaLabel: "Are you a healthcare professional?",
  };
}

/**
 * Thin public chrome for finder / clinics / sales.
 * Signed-in professionals use the global user bar; this header stays logo-only.
 */
export function FinderPublicHeader({
  proSessionHint = false,
  variant = "finder",
  embedded = false,
}: FinderPublicHeaderProps) {
  const { sessionState, showProChrome } = useDoctorSession();
  const hideGuestCtas = sessionState.isLoggedIn || proSessionHint || showProChrome;
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const secondary = secondaryCta();
  const isSales = variant === "sales";
  const showGuestNav = !isSales && !hideGuestCtas;

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname, hideGuestCtas]);

  useEffect(() => {
    if (!showGuestNav || !isMenuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }

    function onDocumentClick(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      setIsMenuOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onDocumentClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onDocumentClick);
    };
  }, [isMenuOpen, showGuestNav]);

  const logo = <DocCyWordmark variant="light" size={isSales ? "xl" : "lg"} />;

  const guestLinks = (
    <>
      <PendingLink href="/login" className={loginLinkClass}>
        Professional login
      </PendingLink>
      <PendingLink
        href={secondary.href}
        aria-label={secondary.ariaLabel}
        className={secondaryLinkClass}
      >
        {secondary.label}
      </PendingLink>
    </>
  );

  return (
    <header
      data-testid={isSales ? "sales-public-header" : "finder-public-header"}
      className={embedded ? "" : "px-4 py-2.5 sm:px-6 lg:px-8"}
    >
      <div className="flex items-center justify-between gap-3">
        {isSales ? (
          <span className="inline-flex shrink-0">{logo}</span>
        ) : (
          <PendingLink href="/" className="inline-flex shrink-0 transition hover:opacity-90">
            {logo}
          </PendingLink>
        )}
        {showGuestNav ? (
          <>
            <nav
              aria-label="Professional access"
              className="hidden min-w-0 shrink-0 items-center gap-2.5 md:flex"
            >
              {guestLinks}
            </nav>

            <div className="relative md:hidden" ref={menuRef}>
              <button
                type="button"
                aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={isMenuOpen}
                aria-controls={menuId}
                data-testid="public-header-menu-toggle"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-[0_1px_2px_rgba(26,43,60,0.06)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50 ${
                  isMenuOpen
                    ? "border-clinical-300 bg-clinical-50 text-clinical-800"
                    : "border-ink-200/90 bg-white text-ink-700 hover:border-clinical-300 hover:bg-clinical-50 hover:text-clinical-800"
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  setIsMenuOpen((open) => !open);
                }}
              >
                <span
                  className="public-guest-menu-icon"
                  data-open={isMenuOpen ? "true" : "false"}
                  aria-hidden
                >
                  <span />
                  <span />
                  <span />
                </span>
              </button>
              <div
                className={`public-guest-menu-blind absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[min(calc(100vw-2rem),18.5rem)] ${
                  isMenuOpen ? "pointer-events-auto" : "pointer-events-none"
                }`}
                data-open={isMenuOpen ? "true" : "false"}
                data-testid="public-header-menu-blind"
              >
                <div className="min-h-0 overflow-hidden">
                  <nav
                    id={menuId}
                    aria-label="Professional access"
                    aria-hidden={!isMenuOpen}
                    data-testid="public-header-menu"
                    className="rounded-[1.35rem] border border-ink-200/70 bg-white/95 p-1.5 shadow-[0_12px_40px_rgba(6,47,97,0.1)] backdrop-blur-xl"
                  >
                    <PendingLink href="/login" className={menuLoginClass}>
                      Professional login
                    </PendingLink>
                    <div className="mx-3 my-0.5 h-px bg-ink-100" aria-hidden />
                    <PendingLink
                      href={secondary.href}
                      aria-label={secondary.ariaLabel}
                      className={menuSecondaryClass}
                    >
                      {secondary.label}
                    </PendingLink>
                  </nav>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}
