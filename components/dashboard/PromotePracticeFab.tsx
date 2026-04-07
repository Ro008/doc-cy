"use client";

import * as React from "react";
import { X, QrCode } from "lucide-react";
import { usePathname } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { PromotePracticeSection } from "@/components/dashboard/PromotePracticeSection";
import { resolvePromotePracticeCopy } from "@/lib/promote-practice-copy";

/**
 * Floating QR / “promote your practice” entry on doctor agenda routes.
 * Sits above the global Feedback bubble (bottom-5).
 */
export function PromotePracticeFab() {
  const pathname = usePathname();
  const supabase = React.useMemo(() => createClientComponentClient(), []);
  const copy = React.useMemo(() => {
    if (typeof navigator === "undefined") return resolvePromotePracticeCopy("en");
    return resolvePromotePracticeCopy(navigator.language);
  }, []);
  const [open, setOpen] = React.useState(false);
  const [doctor, setDoctor] = React.useState<{
    slug: string | null;
    name: string;
    status: string | null;
  } | null>(null);
  const [ready, setReady] = React.useState(false);

  const onAgenda = Boolean(pathname?.startsWith("/agenda"));

  React.useEffect(() => {
    if (!onAgenda) {
      setDoctor(null);
      setReady(false);
      return;
    }

    let cancelled = false;
    setReady(false);

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setDoctor(null);
        setReady(true);
        return;
      }

      const { data, error } = await supabase
        .from("doctors")
        .select("slug, name, status")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("[PromotePracticeFab] doctor fetch", error);
        setDoctor(null);
        setReady(true);
        return;
      }

      if (!data) {
        setDoctor(null);
        setReady(true);
        return;
      }

      setDoctor({
        slug: data.slug ?? null,
        name: data.name ?? "Professional",
        status: (data as { status?: string | null }).status ?? null,
      });
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [onAgenda, supabase]);

  if (!onAgenda || !ready || !doctor || doctor.status !== "verified") {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-5 z-[95] inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/35 bg-slate-900 text-emerald-300 shadow-lg shadow-emerald-900/40 transition hover:border-emerald-300/50 hover:bg-slate-800 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:bottom-20"
        aria-label={copy.fabAriaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <QrCode className="h-5 w-5" strokeWidth={2} aria-hidden />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="promote-practice-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            aria-label={copy.closeAriaLabel}
            onClick={() => setOpen(false)}
          />

          <div className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-emerald-100/10 bg-slate-900/95 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-800/70 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-emerald-200/80">
                  {copy.growthLabel}
                </p>
                <h3
                  id="promote-practice-title"
                  className="mt-1 text-base font-semibold text-slate-50"
                >
                  {copy.title}
                </h3>
                <p className="mt-1 text-xs text-slate-400">{copy.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/60 text-slate-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                aria-label={copy.closeAriaLabel}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <PromotePracticeSection
                slug={doctor.slug}
                doctorName={doctor.name}
                localeLike={typeof navigator === "undefined" ? "en" : navigator.language}
                variant="modal"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
