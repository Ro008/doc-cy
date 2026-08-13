"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";

import { needsSupabaseSessionMiddleware } from "@/lib/needs-supabase-session-middleware";

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
};

const DoctorSessionContext = createContext<DoctorSessionContextValue | null>(null);

export function DoctorSessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const needsSession = needsSupabaseSessionMiddleware(pathname ?? "/");
  const [supabase, setSupabase] = useState<DoctorBrowserClient | null>(null);
  const [sessionState, setSessionState] = useState<DoctorSessionState>(
    LOGGED_OUT_DOCTOR_SESSION,
  );

  useEffect(() => {
    if (!needsSession) return;

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
          setSessionState(LOGGED_OUT_DOCTOR_SESSION);
          return;
        }

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
          setSessionState(LOGGED_OUT_DOCTOR_SESSION);
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
  }, [needsSession]);

  const value = useMemo(
    () => ({ sessionState, setSessionState, supabase }),
    [sessionState, supabase],
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
