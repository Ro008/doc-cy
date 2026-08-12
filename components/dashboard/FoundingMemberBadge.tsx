"use client";

import * as React from "react";
import { X } from "lucide-react";
import { emitOpenFeedback } from "@/lib/doccy-feedback";

export function FoundingMemberBadge({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const el = panelRef.current;
      if (!el) return;
      const t = e.target as Node;
      if (!el.contains(t) && !(t instanceof Element && t.closest("[data-founding-badge-trigger]"))) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        data-founding-badge-trigger
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? "inline-flex shrink-0 items-center rounded-md border border-clinical-400/50 bg-clinical-400/[0.07] px-2 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-clinical-100 shadow-[0_0_16px_-6px_rgba(18,184,192,0.45)] transition hover:border-clinical-300/75 hover:bg-clinical-400/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
            : "inline-flex shrink-0 items-center rounded-lg border border-clinical-400/50 bg-clinical-400/[0.07] px-3 py-2 text-[10px] font-semibold uppercase leading-none tracking-[0.26em] text-clinical-100 shadow-[0_0_22px_-6px_rgba(18,184,192,0.5)] transition hover:border-clinical-300/75 hover:bg-clinical-400/12 hover:shadow-[0_0_30px_-4px_rgba(18,184,192,0.58)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 sm:text-[11px] sm:tracking-[0.3em]"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="founding-member-status-panel"
      >
        FOUNDING MEMBER
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-[60] bg-ink-900/55 backdrop-blur-[2px]"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            id="founding-member-status-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="founding-status-title"
            className="fixed left-1/2 top-[max(4.5rem,12vh)] z-[70] max-h-[min(78vh,calc(100dvh-6rem))] w-[min(calc(100vw-1.25rem),22rem)] -translate-x-1/2 overflow-y-auto rounded-2xl border border-clinical-400/25 bg-slate-900/98 p-4 shadow-[0_0_0_1px_rgba(18,184,192,0.12),0_24px_48px_-12px_rgba(0,0,0,0.65),0_0_40px_-12px_rgba(18,184,192,0.25)] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
              <h2
                id="founding-status-title"
                className="text-sm font-semibold tracking-tight text-slate-50"
              >
                Your Special Status
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 text-slate-400 transition hover:border-clinical-400/35 hover:bg-clinical-400/10 hover:text-clinical-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/50"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <p className="mt-3 text-xs font-medium text-clinical-200/95">
              What does this mean for you?
            </p>

            <ul className="mt-3 space-y-3 text-xs leading-relaxed text-slate-300">
              <li>
                <span className="font-semibold text-slate-200">6 Months of Onboarding:</span> Your
                first 180 days are on us. We want you to see the impact on your practice before you
                pay a cent.
              </li>
              <li>
                <span className="font-semibold text-slate-200">Lifetime Price Protection:</span> As a
                thank you for your early trust, your price is locked at €19/month forever. You will
                never be affected by future price increases.
              </li>
              <li>
                <span className="font-semibold text-slate-200">Founder&apos;s Direct Line:</span> You
                have a direct channel to our founding team. Your feedback shapes the future of
                DocCy.
              </li>
            </ul>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                emitOpenFeedback({ subject: "Founding Member Inquiry" });
              }}
              className="mt-4 w-full rounded-xl border-2 border-clinical-400/45 bg-clinical-400/15 py-2.5 text-sm font-semibold text-clinical-100 shadow-[0_0_24px_-8px_rgba(18,184,192,0.45)] transition hover:border-clinical-300/70 hover:bg-clinical-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              Contact Founding Team
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
