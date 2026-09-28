"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { clearProSessionHintCookie } from "@/lib/pro-session-hint";

/**
 * An account with no professional profile and no application is not kept signed in
 * (user, 2026-09-28): the page shows its message, and the session ends underneath.
 * Renders a marker once signed out (for tests and assistive tech it says nothing).
 */
export function SignOutOnMount() {
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClientComponentClient();
    void supabase.auth.signOut().finally(() => {
      clearProSessionHintCookie();
      if (active) setSignedOut(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return signedOut ? <span hidden data-testid="status-signed-out" /> : null;
}
