"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";

import type { AccountKind, AccountSummary } from "@/lib/account-summary";
import { hasBrowserAuthHint } from "@/lib/browser-auth-hint";
import { isProfessionalMarketingPath } from "@/lib/finder-public-path";
import { needsSupabaseSessionMiddleware } from "@/lib/needs-supabase-session-middleware";
import {
  clearProSessionHintCookie,
  writeProSessionHintCookie,
} from "@/lib/pro-session-hint";

type DoctorBrowserClient = ReturnType<
  typeof import("@supabase/auth-helpers-nextjs").createClientComponentClient
>;

export type DoctorSessionState = {
  isLoggedIn: boolean;
  email: string | null;
  doctorSlug: string | null;
  doctorName: string | null;
  avatarUrl: string | null;
  /**
   * professional = a profile exists (full menu); applicant / none = not approved yet
   * (Support and Log out only). null while unknown.
   */
  accountKind: AccountKind | null;
  /** The avatar is a short-lived private link (an applicant's upload): not for next/image. */
  avatarIsPrivate: boolean;
};

export const LOGGED_OUT_DOCTOR_SESSION: DoctorSessionState = {
  isLoggedIn: false,
  email: null,
  doctorSlug: null,
  doctorName: null,
  avatarUrl: null,
  accountKind: null,
  avatarIsPrivate: false,
};

/** The account behind a login without a profile (applicant or none), via the service role. */
async function fetchAccountSummary(): Promise<AccountSummary | null> {
  try {
    const response = await fetch("/api/account/summary", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as AccountSummary;
  } catch {
    return null;
  }
}

type DoctorSessionContextValue = {
  sessionState: DoctorSessionState;
  setSessionState: Dispatch<SetStateAction<DoctorSessionState>>;
  supabase: DoctorBrowserClient | null;
  /** True once a session hint or confirmed login should show professional chrome. */
  showProChrome: boolean;
  clearLocalDoctorSession: () => void;
};

const DoctorSessionContext = createContext<DoctorSessionContextValue | null>(null);

export function DoctorSessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const routeKey = pathname ?? "/";
  const [supabase, setSupabase] = useState<DoctorBrowserClient | null>(null);
  const [hintChrome, setHintChrome] = useState(false);
  const [sessionState, setSessionState] = useState<DoctorSessionState>(
    LOGGED_OUT_DOCTOR_SESSION,
  );

  const clearLocalDoctorSession = useCallback(() => {
    clearProSessionHintCookie();
    setHintChrome(false);
    setSessionState(LOGGED_OUT_DOCTOR_SESSION);
    if (typeof document !== "undefined") {
      document.documentElement.removeAttribute("data-doccy-pro-chrome");
      document.documentElement.removeAttribute("data-doccy-pro-chrome-agenda");
      document.documentElement.removeAttribute("data-doccy-pro-chrome-hydrated");
    }
  }, []);

  useLayoutEffect(() => {
    if (hasBrowserAuthHint()) setHintChrome(true);
  }, []);

  useEffect(() => {
    const shouldLoadSession =
      needsSupabaseSessionMiddleware(routeKey) ||
      isProfessionalMarketingPath(routeKey) ||
      hasBrowserAuthHint();
    if (!shouldLoadSession) return;

    let isActive = true;
    let unsubscribe: (() => void) | undefined;

    void import("@supabase/auth-helpers-nextjs").then(({ createClientComponentClient }) => {
      if (!isActive) return;
      const client = createClientComponentClient();
      setSupabase(client);

      async function loadSessionState() {
        const {
          data: { user },
        } = await client.auth.getUser();

        if (!isActive) return;

        if (!user) {
          clearLocalDoctorSession();
          return;
        }

        const { data: doctorRow } = await client
          .from("professionals")
          .select("slug, name, avatar_url")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!isActive) return;

        if (!doctorRow) {
          // Not approved yet (or nothing at all): no professional chrome before the
          // page loads next time, and the menu offers only Support and Log out.
          clearProSessionHintCookie();
          const summary = await fetchAccountSummary();
          if (!isActive) return;
          setSessionState({
            isLoggedIn: true,
            email: user.email ?? null,
            doctorSlug: null,
            doctorName: summary?.name ?? null,
            avatarUrl: summary?.photoUrl ?? null,
            accountKind: summary?.kind ?? null,
            avatarIsPrivate: Boolean(summary?.photoUrl),
          });
          return;
        }

        writeProSessionHintCookie();
        setHintChrome(true);

        const avatarPath = String(
          (doctorRow as { avatar_url?: string | null } | null)?.avatar_url ?? "",
        ).trim();
        const avatarUrl = avatarPath
          ? client.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl
          : null;

        setSessionState({
          isLoggedIn: true,
          email: user.email ?? null,
          doctorSlug: typeof doctorRow?.slug === "string" ? doctorRow.slug : null,
          doctorName: typeof doctorRow?.name === "string" ? doctorRow.name : null,
          avatarUrl,
          accountKind: "professional",
          avatarIsPrivate: false,
        });
      }

      void loadSessionState();

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          clearLocalDoctorSession();
          return;
        }
        void loadSessionState();
      });

      unsubscribe = () => subscription.unsubscribe();
    });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [clearLocalDoctorSession, routeKey]);

  const showProChrome = sessionState.isLoggedIn || hintChrome;

  const value = useMemo(
    () => ({
      sessionState,
      setSessionState,
      supabase,
      showProChrome,
      clearLocalDoctorSession,
    }),
    [clearLocalDoctorSession, sessionState, showProChrome, supabase],
  );

  return (
    <DoctorSessionContext.Provider value={value}>{children}</DoctorSessionContext.Provider>
  );
}

export function useDoctorSession() {
  const ctx = useContext(DoctorSessionContext);
  if (!ctx) {
    throw new Error("useDoctorSession must be used within DoctorSessionProvider");
  }
  return ctx;
}
