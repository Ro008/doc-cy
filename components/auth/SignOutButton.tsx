"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export function SignOutButton({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "utility";
}) {
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

  const base =
    "inline-flex items-center rounded-lg text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60";

  const defaultStyle =
    "border border-slate-700/80 bg-slate-900/60 px-2.5 py-1.5 text-slate-300 backdrop-blur hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-200";

  const utilityStyle =
    "gap-1.5 border-0 bg-transparent px-1.5 py-1 text-slate-300/95 hover:bg-slate-800/50 hover:text-slate-100";

  const merged =
    variant === "utility"
      ? `${base} ${utilityStyle}${className ? ` ${className}` : ""}`
      : className
        ? `${base} px-2.5 py-1.5 ${className}`
        : `${base} ${defaultStyle}`;

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className={merged}
    >
      {variant === "utility" ? (
        <LogOut className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      ) : null}
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}

