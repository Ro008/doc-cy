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
};

export const LOGGED_OUT_DOCTOR_SESSION: DoctorSessionState = {
  isLoggedIn: false,
  email: null,
  doctorSlug: null,
  doctorName: null,
  avatarUrl: null,
};

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

        writeProSessionHintCookie();
        setHintChrome(true);

        const { data: doctorRow } = await client
          .from("doctors")
          .select("slug, name, avatar_url")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!isActive) return;

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
