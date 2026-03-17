"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const supabase = createClientComponentClient();

  async function handleSignOut() {
    startTransition(async () => {
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className="inline-flex items-center rounded-2xl border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}

