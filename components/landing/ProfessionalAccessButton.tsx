"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { PendingLink } from "@/components/navigation/PendingLink";

export function ProfessionalAccessButton() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadAuthStatus() {
      setIsCheckingAuth(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!isActive) return;
      setIsLoggedIn(Boolean(user));
      setIsCheckingAuth(false);
    }

    loadAuthStatus();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAuthStatus();
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <PendingLink
      href={isCheckingAuth ? "/login" : isLoggedIn ? "/agenda" : "/login"}
      className={`inline-flex min-w-[11.5rem] items-center justify-center rounded-xl border-2 border-clinical-300 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50 ${
        isCheckingAuth
          ? "pointer-events-none cursor-not-allowed opacity-75"
          : "hover:border-clinical-400 hover:bg-clinical-50"
      }`}
      aria-busy={isCheckingAuth}
      aria-disabled={isCheckingAuth}
    >
      Professional login
    </PendingLink>
  );
}
