"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export function InternalSignOutButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await fetch("/api/internal/logout", { method: "POST" });
      router.push("/internal");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out (internal)"}
    </button>
  );
}
