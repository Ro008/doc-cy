"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  CalendarDays,
  LifeBuoy,
  LogOut,
  Megaphone,
  Settings,
  UserCircle,
  UserRound,
} from "lucide-react";
import { emitOpenFeedback } from "@/lib/doccy-feedback";

type SessionState = {
  isLoggedIn: boolean;
  email: string | null;
  doctorSlug: string | null;
  doctorName: string | null;
  avatarUrl: string | null;
};

type UserBarProps = {
  initialSessionState?: SessionState;
};

function getInitials(name: string | null): string {
  if (!name) return "DC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? "D";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function UserBar({ initialSessionState }: UserBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [sessionState, setSessionState] = useState<SessionState>(
    initialSessionState ?? {
      isLoggedIn: false,
      email: null,
      doctorSlug: null,
      doctorName: null,
      avatarUrl: null,
    }
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadSessionState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isActive) return;

      if (!user) {
        setSessionState({
          isLoggedIn: false,
          email: null,
          doctorSlug: null,
          doctorName: null,
          avatarUrl: null,
        });
        return;
      }

      const { data: doctorRow } = await supabase
        .from("doctors")
        .select("slug, name, avatar_url")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!isActive) return;

      let avatarUrl: string | null = null;
      const avatarPath = String(
        (doctorRow as { avatar_url?: string | null } | null)?.avatar_url ?? "",
      ).trim();
      if (avatarPath) {
        avatarUrl = supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl;
      }

      setSessionState({
        isLoggedIn: true,
        email: user.email ?? null,
        doctorSlug: typeof doctorRow?.slug === "string" ? doctorRow.slug : null,
        doctorName: typeof doctorRow?.name === "string" ? doctorRow.name : null,
        avatarUrl,
      });
    }

    loadSessionState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadSessionState();
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    function onDocumentPointerDown(event: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setIsMenuOpen(false);
    }

    document.addEventListener("pointerdown", onDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", onDocumentPointerDown);
  }, []);

  function handleToggleMenu(event: React.MouseEvent<HTMLButtonElement>) {
    // Prevent outer pointer handlers from seeing this interaction as an outside click.
    event.preventDefault();
    event.stopPropagation();
    setIsMenuOpen((prev) => !prev);
  }

  async function handleLogout() {
    try {
      setIsSigningOut(true);
      await supabase.auth.signOut();
      setIsMenuOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  function handleOpenSupport() {
    setIsMenuOpen(false);
    emitOpenFeedback({ subject: "General Question" });
  }

  if (!sessionState.isLoggedIn || pathname === "/login") {
    return null;
  }

  const initials = getInitials(sessionState.doctorName);

  return (
    <div
      className="absolute right-4 top-4 z-40 sm:right-6 sm:top-5"
      ref={menuRef}
    >
      <button
        type="button"
        onClick={handleToggleMenu}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        data-testid="userbar-toggle"
        className="inline-flex items-center gap-2 rounded-full border border-emerald-300/50 bg-slate-900/85 px-1.5 py-1 shadow-sm shadow-slate-950/40 transition hover:border-emerald-200/90"
      >
        <div className="relative h-8 w-8 overflow-hidden rounded-full bg-slate-800 sm:h-9 sm:w-9">
          {sessionState.avatarUrl ? (
            <Image
              src={sessionState.avatarUrl}
              alt="Doctor avatar"
              fill
              sizes="36px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-emerald-200">
              {initials}
            </div>
          )}
        </div>
        <UserRound className="hidden h-4 w-4 text-emerald-200/90 sm:inline" aria-hidden />
        <span className="sr-only">Open user menu</span>
      </button>

      {isMenuOpen ? (
        <div
          role="menu"
          data-testid="userbar-menu"
          className="absolute right-0 top-[calc(100%+0.4rem)] w-64 overflow-hidden rounded-2xl border border-emerald-200/20 bg-slate-900/95 p-1.5 shadow-2xl shadow-slate-950/70 backdrop-blur"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="relative h-9 w-9 overflow-hidden rounded-full bg-slate-800">
              {sessionState.avatarUrl ? (
                <Image
                  src={sessionState.avatarUrl}
                  alt="Doctor avatar"
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-emerald-200">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-50">
                {sessionState.doctorName ?? "Logged in"}
              </p>
              <p className="truncate text-[11px] text-slate-400">
                {sessionState.email ?? ""}
              </p>
            </div>
          </div>

          <Link
            href="/agenda"
            data-testid="userbar-link-agenda"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-800/90"
            role="menuitem"
          >
            <CalendarDays className="h-4 w-4 text-emerald-300" aria-hidden />
            My Agenda
          </Link>
          <Link
            href="/agenda/settings"
            data-testid="userbar-link-settings"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-800/90"
            role="menuitem"
          >
            <Settings className="h-4 w-4 text-emerald-300" aria-hidden />
            Settings
          </Link>
          <Link
            href="/agenda/settings#promote-practice"
            data-testid="userbar-link-promote"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-800/90"
            role="menuitem"
          >
            <Megaphone className="h-4 w-4 text-emerald-300" aria-hidden />
            Promote Your Practice
          </Link>
          <button
            type="button"
            onClick={handleOpenSupport}
            data-testid="userbar-action-support"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-800/90"
            role="menuitem"
          >
            <LifeBuoy className="h-4 w-4 text-emerald-300" aria-hidden />
            Support
          </button>
          {sessionState.doctorSlug ? (
            <Link
              href={`/${sessionState.doctorSlug}`}
              data-testid="userbar-link-public-profile"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-800/90"
              role="menuitem"
            >
              <UserCircle className="h-4 w-4 text-emerald-300" aria-hidden />
              View Public Profile
            </Link>
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
    </div>
  );
}
