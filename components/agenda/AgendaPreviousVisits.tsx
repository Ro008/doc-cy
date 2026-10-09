"use client";

import * as React from "react";
import { Loader2, X } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import { isNoShowAttendance } from "@/lib/appointment-attendance";
import type { AgendaPreviousVisit } from "@/lib/previous-visits";

type Loaded = { visits: AgendaPreviousVisit[]; hasMore: boolean };
type State = { status: "loading" } | ({ status: "ready" } & Loaded) | { status: "none" };

function useVisits(appointmentId: string, all: boolean, enabled: boolean): State {
  const [state, setState] = React.useState<State>({ status: "loading" });
  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`/api/appointments/${encodeURIComponent(appointmentId)}/previous-visits${all ? "?all=1" : ""}`, {
      credentials: "include",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        const visits = Array.isArray(data?.visits) ? (data.visits as AgendaPreviousVisit[]) : [];
        setState(res.ok && visits.length > 0 ? { status: "ready", visits, hasMore: Boolean(data.hasMore) } : { status: "none" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "none" });
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId, all, enabled]);
  return state;
}

function VisitRows({
  visits,
  clinicName,
}: {
  visits: AgendaPreviousVisit[];
  clinicName: (clinicId: string | null) => string | null;
}) {
  return (
    <ul className="space-y-2">
      {visits.map((v) => {
        const clinic = clinicName(v.clinic_id);
        return (
          <li key={v.id} className="text-sm">
            <p className="flex flex-wrap items-center gap-x-2 text-slate-200">
              <span className="tabular-nums">
                {formatInTimeZone(new Date(v.appointment_datetime), CY_TZ, "d MMM yyyy, HH:mm")}
              </span>
              {clinic ? <span className="text-slate-500">at {clinic}</span> : null}
              {isNoShowAttendance(v.attendance) ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                  No-show
                </span>
              ) : null}
            </p>
            {v.professional_notes ? (
              <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{v.professional_notes}</p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-500">No notes.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Her last 3 visits with this patient, with her private notes, at the bottom of the agenda's
 * visit window (user, 2026-10-08). "Show more" opens a window with all of them, newest first.
 * Loaded when the visit opens; says nothing when there are none.
 */
export function AgendaPreviousVisits({
  appointmentId,
  patientName,
  clinicName,
}: {
  appointmentId: string;
  patientName?: string | null;
  /** Only returns a name when she has several clinics (then each visit says where it was). */
  clinicName: (clinicId: string | null) => string | null;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const state = useVisits(appointmentId, false, true);
  const full = useVisits(appointmentId, true, showAll);

  React.useEffect(() => {
    setShowAll(false);
  }, [appointmentId]);

  if (state.status === "none") return null;
  if (state.status === "loading") {
    return (
      <div
        role="status"
        data-testid="agenda-previous-visits-loading"
        className="mt-6 flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-3 text-xs text-slate-400"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading previous visits…
      </div>
    );
  }

  return (
    <>
      <section
        className="mt-6 rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2"
        data-testid="agenda-previous-visits"
        aria-label="Previous visits with this patient"
      >
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Previous visits with you</p>
        <div className="[&_p.whitespace-pre-wrap]:line-clamp-2">
          <VisitRows visits={state.visits} clinicName={clinicName} />
        </div>
        {state.hasMore ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            data-testid="previous-visits-show-more"
            className="mt-2 text-xs font-semibold text-clinical-300 transition hover:text-clinical-200"
          >
            Show more
          </button>
        ) : null}
      </section>

      {showAll ? (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="All previous visits with this patient"
          data-testid="previous-visits-all"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setShowAll(false)}
            className="absolute inset-0 bg-ink-900/70 backdrop-blur-sm"
          />
          <div className="relative z-10 w-full max-w-sm max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl border border-clinical-100/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl sm:max-h-[calc(100dvh-2rem)]">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setShowAll(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="pr-8 text-lg font-semibold text-slate-50">Previous visits with you</h3>
            {patientName ? <p className="mt-0.5 text-sm text-slate-400">{patientName} · newest first</p> : null}
            <div className="mt-4">
              {full.status === "loading" ? (
                <p role="status" className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Loading previous visits…
                </p>
              ) : full.status === "ready" ? (
                <VisitRows visits={full.visits} clinicName={clinicName} />
              ) : (
                <p className="text-sm text-slate-400">No earlier visits found.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
