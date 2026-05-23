"use client";

import {
  CalendarPlus,
  LifeBuoy,
  LogOut,
  Megaphone,
  UserCircle,
} from "lucide-react";

import { UserMenuNavLink } from "@/components/navigation/UserMenuNavLink";

type UserBarMoreMenuItemsProps = {
  publicProfilePath: string | null;
  isSigningOut: boolean;
  onLogout: () => void;
  onSupport: () => void;
  testIdPrefix?: string;
};

export function UserBarMoreMenuItems({
  publicProfilePath,
  isSigningOut,
  onLogout,
  onSupport,
  testIdPrefix = "userbar-more",
}: UserBarMoreMenuItemsProps) {
  return (
    <>
      {publicProfilePath ? (
        <UserMenuNavLink
          href={publicProfilePath}
          data-testid={`${testIdPrefix}-link-public-profile`}
          icon={<UserCircle className="h-4 w-4 text-emerald-300" aria-hidden />}
        >
          View Public Profile
        </UserMenuNavLink>
      ) : null}
      <UserMenuNavLink
        href="/agenda/settings#promote-practice"
        data-testid={`${testIdPrefix}-link-promote`}
        icon={<Megaphone className="h-4 w-4 text-emerald-300" aria-hidden />}
      >
        Promote Your Practice
      </UserMenuNavLink>
      <button
        type="button"
        onClick={onSupport}
        data-testid={`${testIdPrefix}-action-support`}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-800/90 active:scale-[0.99] active:bg-slate-800/90"
        role="menuitem"
      >
        <LifeBuoy className="h-4 w-4 text-emerald-300" aria-hidden />
        Support
      </button>
      <button
        type="button"
        onClick={onLogout}
        disabled={isSigningOut}
        data-testid={`${testIdPrefix}-action-logout`}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-200 transition hover:bg-red-500/15 disabled:opacity-70"
        role="menuitem"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        {isSigningOut ? "Logging out..." : "Logout"}
      </button>
      <UserMenuNavLink
        href="/agenda?manual=1"
        title="Took a phone call? Block the slot manually here. Next time, share your link to save time."
        data-testid={`${testIdPrefix}-link-manual-booking`}
        className="mt-0.5 border border-emerald-300/30 bg-emerald-500/10 font-semibold text-emerald-100 hover:bg-emerald-500/20"
        icon={<CalendarPlus className="h-4 w-4 text-emerald-200" aria-hidden />}
      >
        + Add Manual Booking
      </UserMenuNavLink>
    </>
  );
}
