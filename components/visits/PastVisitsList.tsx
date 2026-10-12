"use client";

import * as React from "react";
import { ChevronDown, History, PencilLine, Plus } from "lucide-react";
import { isNoShowAttendance } from "@/lib/appointment-attendance";
import { patientBirthdateLabel, patientSummaryParts } from "@/lib/patient-details";
import { patientVisitsHref, type PastVisitRow } from "@/lib/past-visits";
import { groupVisitsByMonth, patientInitials, visitDateParts } from "@/lib/past-visits-view";
import { VisitNotesBox } from "@/components/agenda/VisitNotesBox";

export type VisitClinicInfo = { name: string; swatch: string };

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-200">{children}</dd>
    </div>
  );
}

function VisitCard({
  visit,
  clinic,
  notes,
  onNotesSaved,
}: {
  visit: PastVisitRow;
  clinic: VisitClinicInfo | null;
  notes: string | null;
  onNotesSaved: (id: string, notes: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  const when = visitDateParts(visit.appointment_datetime);
  const name = visit.patient_name?.trim() || "Patient";
  const noShow = isNoShowAttendance(visit.attendance);
  const hasNotes = Boolean(notes?.trim());
  const summary = patientSummaryParts({
    birthdate: visit.patient_birthdate,
    gender: visit.patient_gender,
    isNewPatient: visit.is_new_patient,
  });
  const born = patientBirthdateLabel(visit.patient_birthdate);
  const historyHref = patientVisitsHref(visit);

  return (
    <li
      data-testid="past-visit"
      data-visit-id={visit.id}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900/80 to-ink-900/70 shadow-md shadow-black/10 transition ${
        open ? "border-clinical-500/40" : "border-white/10 hover:border-clinical-500/30"
      }`}
    >
      {clinic ? <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${clinic.swatch}`} /> : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-4 px-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clinical-500/50 sm:px-5"
      >
        <span
          aria-hidden
          className="flex w-14 shrink-0 flex-col items-center rounded-xl border border-clinical-500/25 bg-clinical-500/10 py-1.5"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-clinical-300">{when.month}</span>
          <span className="text-2xl font-bold leading-none text-slate-50">{when.day}</span>
          <span className="mt-1 text-[10px] text-slate-400">{when.weekday}</span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              aria-hidden
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-clinical-500/20 text-[11px] font-bold text-clinical-200"
            >
              {patientInitials(name)}
            </span>
            <span className="text-base font-semibold text-slate-50" data-testid="past-visit-patient">
              {name}
            </span>
            {visit.is_new_patient === true ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                New patient
              </span>
            ) : null}
            {noShow ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                No-show
              </span>
            ) : null}
          </span>

          <span className="mt-1 block text-xs text-slate-400">
            {when.time}
            {clinic ? <span className="text-slate-500"> · {clinic.name}</span> : null}
          </span>

          {visit.service_name || visit.reason?.trim() ? (
            <span className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
              {visit.service_name ? (
                <span className="rounded-full bg-clinical-500/15 px-2.5 py-0.5 text-xs font-semibold text-clinical-200">
                  {visit.service_name}
                </span>
              ) : null}
              {visit.reason?.trim() ? <span className="line-clamp-1">{visit.reason.trim()}</span> : null}
            </span>
          ) : null}

          {!open ? (
            hasNotes ? (
              <span
                data-testid="past-visit-notes-preview"
                className="mt-3 flex gap-2 border-l-2 border-clinical-400/60 pl-3 text-sm text-slate-300"
              >
                <PencilLine aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-clinical-300" />
                <span className="line-clamp-2 whitespace-pre-wrap">{notes}</span>
              </span>
            ) : (
              <span
                data-testid="past-visit-notes-preview"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-clinical-500/40 px-3 py-1 text-xs font-medium text-clinical-300"
              >
                <Plus aria-hidden className="h-3.5 w-3.5" />
                Add notes
              </span>
            )
          ) : null}
        </span>

        <ChevronDown
          aria-hidden
          className={`mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div id={panelId} className="border-t border-white/10 px-4 pb-4 pt-4 sm:px-5" data-testid="past-visit-details">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Patient">
              {name}
              {summary.length > 0 ? <span className="block text-xs text-slate-400">{summary.join(" · ")}</span> : null}
              {born ? <span className="block text-xs text-slate-500">{born}</span> : null}
            </Detail>
            <Detail label="Contact">
              {visit.patient_phone ? (
                <a href={`tel:${visit.patient_phone.replace(/[^\d+]/g, "")}`} className="block text-clinical-200 hover:underline">
                  {visit.patient_phone}
                </a>
              ) : null}
              {visit.patient_email ? (
                <a href={`mailto:${visit.patient_email}`} className="block text-clinical-200 hover:underline">
                  {visit.patient_email}
                </a>
              ) : null}
              {!visit.patient_phone && !visit.patient_email ? "—" : null}
            </Detail>
            <Detail label="Service">{visit.service_name || <span className="text-slate-500">None chosen</span>}</Detail>
            <Detail label="Duration">{visit.duration_minutes ? `${visit.duration_minutes} min` : "—"}</Detail>
            <div className="sm:col-span-2">
              <Detail label="Reason for the visit">
                {visit.reason?.trim() ? (
                  <span className="whitespace-pre-wrap">{visit.reason.trim()}</span>
                ) : (
                  <span className="text-slate-500">Not given</span>
                )}
              </Detail>
            </div>
          </dl>
          <VisitNotesBox appointmentId={visit.id} initialNotes={notes} onSaved={(n) => onNotesSaved(visit.id, n)} />
          {historyHref ? (
            <a
              href={historyHref}
              data-testid="past-visit-patient-history"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-clinical-200 transition hover:text-clinical-100 hover:underline"
            >
              <History aria-hidden className="h-4 w-4" />
              All visits with this patient
            </a>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Her past visits, newest first, under month headings (user, 2026-10-12). A card opens to the
 * patient's details, the reason, the service and her notes, which she can edit there.
 */
export function PastVisitsList({
  visits,
  clinics,
}: {
  visits: PastVisitRow[];
  /** By `clinics.id`; empty with a single clinic (nothing to tell apart). */
  clinics: Record<string, VisitClinicInfo>;
}) {
  const [notes, setNotes] = React.useState<Record<string, string | null>>({});
  const onNotesSaved = React.useCallback((id: string, value: string | null) => {
    setNotes((prev) => ({ ...prev, [id]: value }));
  }, []);

  return (
    <div className="space-y-6" data-testid="past-visits-list">
      {groupVisitsByMonth(visits).map((group) => (
        <section key={group.key} aria-labelledby={`month-${group.key}`}>
          <h2
            id={`month-${group.key}`}
            data-testid="past-visits-month"
            className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-slate-400"
          >
            {group.label}
            <span className="font-medium normal-case tracking-normal text-slate-600">
              {group.visits.length} {group.visits.length === 1 ? "visit" : "visits"}
            </span>
            <span aria-hidden className="h-px flex-1 bg-white/10" />
          </h2>
          <ul className="space-y-3">
            {group.visits.map((v) => (
              <VisitCard
                key={v.id}
                visit={v}
                clinic={v.clinic_id ? (clinics[v.clinic_id] ?? null) : null}
                notes={v.id in notes ? notes[v.id] : v.professional_notes}
                onNotesSaved={onNotesSaved}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
