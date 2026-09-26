import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminSignIn } from "@/components/internal/AdminSignIn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign-in · DocCy",
  robots: { index: false, follow: false },
};

export default function AdminSignInPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-400">
          Loading…
        </main>
      }
    >
      <AdminSignIn />
    </Suspense>
  );
}
