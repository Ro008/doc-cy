"use client";

import { MANUAL_BOOKING_HINT, MANUAL_BOOKING_LABEL } from "@/lib/manual-booking-copy";
import type { AccountMenuItemId } from "@/lib/doctor-routes";

import {
  CalendarPlus,
  CreditCard,
  LifeBuoy,
  LogOut,
  UserCircle,
  UserCog,
} from "lucide-react";

import { UserMenuNavLink } from "@/components/navigation/UserMenuNavLink";

type UserBarMoreMenuItemsProps = {
  /** From `accountMenuItems`, in order. */
  items: readonly AccountMenuItemId[];
  publicProfilePath: string | null;
  isSigningOut: boolean;
  onLogout: () => void;
  onSupport: () => void;
  testIdPrefix?: string;
};

/** The account menu's items: the same list in the desktop photo menu and in "More" on a phone. */
export function UserBarMoreMenuItems({
  items,
  publicProfilePath,
  isSigningOut,
  onLogout,
  onSupport,
  testIdPrefix = "userbar-more",
}: UserBarMoreMenuItemsProps) {
  const iconClass = "h-4 w-4 text-clinical-300";
  return (
    <>
      {items.map((item) => {
        switch (item) {
          case "manual-booking":
            return (
              <UserMenuNavLink
                key={item}
                href="/agenda?manual=1"
                title={MANUAL_BOOKING_HINT}
                data-testid={`${testIdPrefix}-link-manual-booking`}
                className="mb-1 border border-clinical-400/35 bg-clinical-500/10 font-semibold text-clinical-100 hover:bg-clinical-500/20"
                icon={<CalendarPlus className="h-4 w-4 text-clinical-200" aria-hidden />}
              >
                {MANUAL_BOOKING_LABEL}
              </UserMenuNavLink>
            );
          case "account":
            return (
              <UserMenuNavLink
                key={item}
                href="/settings?section=account"
                data-testid={`${testIdPrefix}-link-account`}
                icon={<UserCog className={iconClass} aria-hidden />}
              >
                Account
              </UserMenuNavLink>
            );
          case "plan":
            return (
              <UserMenuNavLink
                key={item}
                href="/settings?section=plan"
                data-testid={`${testIdPrefix}-link-plan`}
                icon={<CreditCard className={iconClass} aria-hidden />}
              >
                Plan &amp; billing
              </UserMenuNavLink>
            );
          case "public-profile":
            return publicProfilePath ? (
              <UserMenuNavLink
                key={item}
                href={publicProfilePath}
                data-testid={`${testIdPrefix}-link-public-profile`}
                icon={<UserCircle className={iconClass} aria-hidden />}
              >
                View public profile
              </UserMenuNavLink>
            ) : null;
          case "support":
            return (
              <button
                key={item}
                type="button"
                onClick={onSupport}
                data-testid={`${testIdPrefix}-action-support`}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-100 transition hover:bg-ink-800/90 active:scale-[0.99] active:bg-ink-800/90"
                role="menuitem"
              >
                <LifeBuoy className={iconClass} aria-hidden />
                Support
              </button>
            );
          case "logout":
            return (
              <div key={item}>
                <div role="separator" className="my-1 border-t border-white/10" />
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={isSigningOut}
                  data-testid={`${testIdPrefix}-action-logout`}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-200 transition hover:bg-red-500/15 disabled:opacity-70"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  {isSigningOut ? "Logging out…" : "Log out"}
                </button>
              </div>
            );
        }
      })}
    </>
  );
}
