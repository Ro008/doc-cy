"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { UserMenuNavLink } from "@/components/navigation/UserMenuNavLink";
import { UserBarMoreMenuItems } from "@/components/navigation/UserBarMoreMenuItems";
import { MobileTabNavLink } from "@/components/navigation/MobileTabNavLink";
import { PendingLink } from "@/components/navigation/PendingLink";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import {
  LOGGED_OUT_DOCTOR_SESSION,
  useDoctorSession,
} from "@/components/navigation/DoctorSessionProvider";
import {
  BarChart3,
  CalendarPlus,
  CalendarDays,
  LifeBuoy,
  LogOut,
  Megaphone,
  MoreHorizontal,
  Settings,
  UserCircle,
  UserRound,
} from "lucide-react";
import { emitOpenFeedback } from "@/lib/doccy-feedback";

function getInitials(name: string | null): string {
  if (!name) return "DC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? "D";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function UserBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { sessionState, setSessionState, supabase } = useDoctorSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const mobileMoreMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMoreAnchorRef = useRef<HTMLDivElement | null>(null);
  const isMenuOpenRef = useRef(isMenuOpen);
  const isMobileMoreOpenRef = useRef(isMobileMoreOpen);
  const ignoreNextOutsideCloseRef = useRef(false);

  useEffect(() => {
    isMenuOpenRef.current = isMenuOpen;
  }, [isMenuOpen]);

  useEffect(() => {
    isMobileMoreOpenRef.current = isMobileMoreOpen;
  }, [isMobileMoreOpen]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (ignoreNextOutsideCloseRef.current) {
        ignoreNextOutsideCloseRef.current = false;
        return;
      }

      if (!isMenuOpenRef.current && !isMobileMoreOpenRef.current) return;

      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (mobileMoreMenuRef.current?.contains(target)) return;
      if (mobileMoreAnchorRef.current?.contains(target)) return;
      isMenuOpenRef.current = false;
      isMobileMoreOpenRef.current = false;
      setIsMenuOpen(false);
      setIsMobileMoreOpen(false);
    }

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  useEffect(() => {
    isMenuOpenRef.current = false;
    isMobileMoreOpenRef.current = false;
    setIsMenuOpen(false);
    setIsMobileMoreOpen(false);
  }, [pathname]);

  function handleToggleMenu(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    ignoreNextOutsideCloseRef.current = true;
    setIsMenuOpen((prev) => {
      const next = !prev;
      isMenuOpenRef.current = next;
      if (next) isMobileMoreOpenRef.current = false;
      return next;
    });
  }

  async function handleLogout() {
    try {
      setIsSigningOut(true);
      if (supabase) {
        await supabase.auth.signOut();
      }
      setSessionState(LOGGED_OUT_DOCTOR_SESSION);
      isMenuOpenRef.current = false;
      isMobileMoreOpenRef.current = false;
      setIsMenuOpen(false);
      setIsMobileMoreOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  function handleCloseMenus() {
    isMenuOpenRef.current = false;
    isMobileMoreOpenRef.current = false;
    setIsMenuOpen(false);
    setIsMobileMoreOpen(false);
  }

  function handleOpenSupport() {
    handleCloseMenus();
    emitOpenFeedback({ subject: "General Question" });
  }

  function handleToggleMobileMore(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    ignoreNextOutsideCloseRef.current = true;
    setIsMobileMoreOpen((prev) => {
      const next = !prev;
      isMobileMoreOpenRef.current = next;
      if (next) isMenuOpenRef.current = false;
      return next;
    });
  }

  const isDistractionFreeDoctorFlow = pathname.startsWith("/dashboard/appointments/");
  const isAccountReviewGate = pathname.startsWith("/agenda/account-review");

  if (
    !sessionState.isLoggedIn ||
    pathname === "/login" ||
    isDistractionFreeDoctorFlow ||
    isAccountReviewGate
  ) {
    return null;
  }

  const initials = getInitials(sessionState.doctorName);
  const slug = sessionState.doctorSlug?.trim() || null;
  const publicProfilePath = slug ? `/${slug}` : null;

  const pathNorm = pathname.replace(/\/$/, "") || "/";

  const isAgendaActive = pathNorm === "/agenda";
  const isInsightsActive = pathname.startsWith("/agenda/insights");
  const isSettingsActive = pathname.startsWith("/agenda/settings");
  const isPublicProfileActive = Boolean(
    slug && (pathNorm === `/${slug}` || pathNorm.endsWith(`/${slug}`)),
  );
  const isMoreActive = isMobileMoreOpen || isPublicProfileActive;

  const tabBaseClass =
    "flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium leading-tight transition active:scale-[0.98] sm:text-[11px]";
  const tabInactiveClass = "text-ink-200 hover:text-ink-50";
  const tabActiveClass = "font-semibold text-clinical-100";

  const useStickyDesktopChrome = pathname.startsWith("/agenda");

  const desktopUserMenu = (
    <>
      <button
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={handleToggleMenu}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        data-testid="userbar-toggle"
        className="inline-flex items-center gap-2 rounded-full border border-clinical-400/45 bg-ink-900/90 px-1.5 py-1 shadow-sm shadow-ink-900/40 transition hover:border-clinical-300/80"
      >
        <div className="relative h-8 w-8 overflow-hidden rounded-full bg-ink-800 sm:h-9 sm:w-9">
          {sessionState.avatarUrl ? (
            <Image
              src={sessionState.avatarUrl}
              alt="Doctor avatar"
              fill
              sizes="36px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-clinical-200">
              {initials}
            </div>
          )}
        </div>
        <UserRound className="hidden h-4 w-4 text-clinical-200/90 sm:inline" aria-hidden />
        <span className="sr-only">Open user menu</span>
      </button>

      {isMenuOpen ? (
        <div
          role="menu"
          data-testid="userbar-menu"
          className="absolute right-0 top-[calc(100%+0.4rem)] w-64 overflow-hidden rounded-2xl border border-clinical-400/25 bg-ink-900/95 p-1.5 shadow-2xl shadow-ink-900/70 backdrop-blur"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="relative h-9 w-9 overflow-hidden rounded-full bg-ink-800">
              {sessionState.avatarUrl ? (
                <Image
                  src={sessionState.avatarUrl}
                  alt="Doctor avatar"
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-clinical-200">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink-50">
                {sessionState.doctorName ?? "Logged in"}
              </p>
              <p className="truncate text-[11px] text-ink-400">
                {sessionState.email ?? ""}
              </p>
            </div>
          </div>

          <UserMenuNavLink
            href="/agenda?manual=1"
            title="Took a phone call? Block the slot manually here. Next time, share your link to save time."
            data-testid="userbar-link-manual-booking"
            className="mb-1 border border-clinical-400/35 bg-clinical-500/10 font-semibold text-clinical-100 hover:bg-clinical-500/20"
            icon={<CalendarPlus className="h-4 w-4 text-clinical-200" aria-hidden />}
          >
            + Add Manual Booking
          </UserMenuNavLink>
          <UserMenuNavLink
            href="/agenda"
            data-testid="userbar-link-agenda"
            icon={<CalendarDays className="h-4 w-4 text-clinical-300" aria-hidden />}
          >
            My Agenda
          </UserMenuNavLink>
          <UserMenuNavLink
            href="/agenda/insights"
            data-testid="userbar-link-insights"
            icon={<BarChart3 className="h-4 w-4 text-clinical-300" aria-hidden />}
          >
            Practice insights
          </UserMenuNavLink>
          <UserMenuNavLink
            href="/agenda/settings"
            data-testid="userbar-link-settings"
            icon={<Settings className="h-4 w-4 text-clinical-300" aria-hidden />}
          >
            Settings
          </UserMenuNavLink>
          <UserMenuNavLink
            href="/agenda/settings#promote-practice"
            data-testid="userbar-link-promote"
            icon={<Megaphone className="h-4 w-4 text-clinical-300" aria-hidden />}
          >
            Promote Your Practice
          </UserMenuNavLink>
          <button
            type="button"
            onClick={handleOpenSupport}
            data-testid="userbar-action-support"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-100 transition hover:bg-ink-800/90 active:scale-[0.99] active:bg-ink-800/90"
            role="menuitem"
          >
            <LifeBuoy className="h-4 w-4 text-clinical-300" aria-hidden />
            Support
          </button>
          {slug ? (
            <UserMenuNavLink
              href={publicProfilePath!}
              data-testid="userbar-link-public-profile"
              icon={<UserCircle className="h-4 w-4 text-clinical-300" aria-hidden />}
            >
              View Public Profile
            </UserMenuNavLink>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isSigningOut}
            data-testid="userbar-action-logout"
            className="mt-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-200 transition hover:bg-red-500/15 disabled:opacity-70"
            role="menuitem"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {isSigningOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      {useStickyDesktopChrome ? (
        <header
          data-testid="pro-sticky-header"
          className="sticky top-0 z-50 hidden border-b border-clinical-400/15 bg-ink-900/90 shadow-sm shadow-ink-900/25 backdrop-blur-md lg:block"
        >
          <div className="mx-auto flex h-14 max-w-[1920px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <PendingLink href="/agenda" className="inline-flex shrink-0 transition hover:opacity-90">
              <DocCyWordmark variant="dark" />
            </PendingLink>
            <div className="relative shrink-0" ref={menuRef}>
              {desktopUserMenu}
            </div>
          </div>
        </header>
      ) : (
        <div
          className="absolute right-4 top-4 z-40 hidden sm:right-6 sm:top-5 lg:block"
          ref={menuRef}
        >
          {desktopUserMenu}
        </div>
      )}

      {/* Mobile / tablet: fixed bottom tab bar (<lg) */}
      {isMobileMoreOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          data-testid="userbar-mobile-more-backdrop"
          className="fixed inset-0 z-40 bg-ink-900/50 lg:hidden"
          onClick={handleCloseMenus}
        />
      ) : null}
      <nav
        aria-label="Professional navigation"
        data-testid="userbar-mobile-tabs"
        className="fixed inset-x-0 bottom-0 z-50 overflow-visible border-t border-white/10 bg-ink-900/85 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_28px_rgba(15,31,46,0.55)] backdrop-blur-2xl supports-[backdrop-filter]:bg-ink-900/72 lg:hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.02)_42%,transparent_100%)]"
        />
        {isMobileMoreOpen ? (
          <div
            ref={mobileMoreMenuRef}
            role="menu"
            data-testid="userbar-mobile-more-menu"
            className="absolute inset-x-2 bottom-[calc(100%+0.35rem)] z-[60] overflow-hidden rounded-2xl border border-white/10 bg-ink-900/90 p-1.5 shadow-2xl shadow-ink-900/70 backdrop-blur-xl supports-[backdrop-filter]:bg-ink-900/82"
          >
            <UserBarMoreMenuItems
              publicProfilePath={publicProfilePath}
              isSigningOut={isSigningOut}
              onLogout={handleLogout}
              onSupport={handleOpenSupport}
              testIdPrefix="userbar-mobile-more"
            />
          </div>
        ) : null}
        <div className="relative mx-auto flex max-w-2xl items-stretch justify-between gap-0 px-1 pt-0.5">
          <MobileTabNavLink
            href="/agenda"
            label="Agenda"
            data-testid="userbar-tab-agenda"
            isActive={isAgendaActive}
            baseClass={tabBaseClass}
            activeClass={tabActiveClass}
            inactiveClass={tabInactiveClass}
            icon={
              <CalendarDays className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden />
            }
          />
          <MobileTabNavLink
            href="/agenda/insights"
            label="Insights"
            data-testid="userbar-tab-insights"
            isActive={isInsightsActive}
            baseClass={tabBaseClass}
            activeClass={tabActiveClass}
            inactiveClass={tabInactiveClass}
            icon={
              <BarChart3 className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden />
            }
          />
          <MobileTabNavLink
            href="/agenda/settings"
            label="Settings"
            data-testid="userbar-tab-settings"
            isActive={isSettingsActive}
            baseClass={tabBaseClass}
            activeClass={tabActiveClass}
            inactiveClass={tabInactiveClass}
            icon={
              <Settings className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden />
            }
          />
          <div ref={mobileMoreAnchorRef} className="relative flex min-w-0 flex-1">
            <button
              type="button"
              data-testid="userbar-tab-more"
              aria-expanded={isMobileMoreOpen}
              aria-haspopup="menu"
              onClick={handleToggleMobileMore}
              className={`${tabBaseClass} w-full ${isMoreActive ? tabActiveClass : tabInactiveClass}`}
            >
              <MoreHorizontal
                className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]"
                aria-hidden
              />
              <span>More</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
