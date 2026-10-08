import { formatInTimeZone } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import { isNoShowAttendance } from "@/lib/appointment-attendance";
import type { PreviousVisitRow } from "@/lib/previous-visits";

/**
 * Her past visits with this patient, with her private notes (user, 2026-10-04). Matched on
 * email or phone, so it says it's a likely match.
 */
export function PreviousVisitsList({
  visits,
  clinicName,
}: {
  visits: PreviousVisitRow[];
  clinicName: (clinicId: string | null) => string | null;
}) {
  if (visits.length === 0) return null;
  return (
    <section className="mt-8 border-t border-ink-700/60 pt-6" data-testid="previous-visits" aria-labelledby="previous-visits-title">
      <h2 id="previous-visits-title" className="text-sm font-semibold text-ink-50">
        Previous visits with you
      </h2>
      <p className="mt-0.5 text-xs text-ink-500">Matched on the same email or phone. Your notes are private to you.</p>
      <ul className="mt-3 space-y-2">
        {visits.map((v) => {
          const clinic = clinicName(v.clinic_id);
          return (
            <li key={v.id} className="rounded-xl border border-ink-700/70 bg-ink-900/40 px-3 py-2 text-sm">
              <p className="flex flex-wrap items-center gap-x-2 text-ink-200">
                <span className="tabular-nums">
                  {formatInTimeZone(new Date(v.appointment_datetime), CY_TZ, "d MMM yyyy, HH:mm")}
                </span>
                {clinic ? <span className="text-ink-500">at {clinic}</span> : null}
                {isNoShowAttendance(v.attendance) ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                    No-show
                  </span>
                ) : null}
              </p>
              {v.professional_notes ? (
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink-300">{v.professional_notes}</p>
              ) : (
                <p className="mt-1 text-xs text-ink-500">No notes.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
