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
      className={`inline-flex min-w-[11.5rem] items-center justify-center rounded-xl border-2 border-white/45 bg-neutral-800/90 px-5 py-2.5 text-sm font-semibold text-neutral-50 shadow-md shadow-black/30 backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 ${
        isCheckingAuth
          ? "cursor-not-allowed opacity-75 pointer-events-none"
          : "hover:border-white/65 hover:bg-neutral-700/95 hover:text-white"
      }`}
      aria-busy={isCheckingAuth}
      aria-disabled={isCheckingAuth}
    >
      Professional login
    </PendingLink>
  );
}
