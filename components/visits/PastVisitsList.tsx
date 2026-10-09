"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import { isNoShowAttendance } from "@/lib/appointment-attendance";
import { patientBirthdateLabel, patientSummaryParts } from "@/lib/patient-details";
import type { PastVisitRow } from "@/lib/past-visits";
import { VisitNotesBox } from "@/components/agenda/VisitNotesBox";

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
  clinicName,
  notes,
  onNotesSaved,
}: {
  visit: PastVisitRow;
  clinicName: string | null;
  notes: string | null;
  onNotesSaved: (id: string, notes: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  const when = new Date(visit.appointment_datetime);
  const summary = patientSummaryParts({
    birthdate: visit.patient_birthdate,
    gender: visit.patient_gender,
    isNewPatient: visit.is_new_patient,
  });
  const born = patientBirthdateLabel(visit.patient_birthdate);

  return (
    <li
      data-testid="past-visit"
      data-visit-id={visit.id}
      className="rounded-2xl border border-slate-700/70 bg-slate-900/60"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-slate-800/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/50"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-slate-50" data-testid="past-visit-patient">
              {visit.patient_name?.trim() || "Patient"}
            </span>
            {isNoShowAttendance(visit.attendance) ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                No-show
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-xs tabular-nums text-slate-400">
            {formatInTimeZone(when, CY_TZ, "EEE d MMM yyyy, HH:mm")}
            {clinicName ? <span className="text-slate-500"> · {clinicName}</span> : null}
          </span>
          <span className="mt-1.5 block text-sm text-slate-300">
            {visit.service_name ? (
              <span className="mr-2 inline-block rounded-full bg-clinical-500/15 px-2 py-0.5 text-[11px] font-semibold text-clinical-200">
                {visit.service_name}
              </span>
            ) : null}
            {visit.reason?.trim() ? <span className="line-clamp-1">{visit.reason.trim()}</span> : null}
          </span>
          {!open ? (
            <span className="mt-1 block line-clamp-2 whitespace-pre-wrap text-xs text-slate-500" data-testid="past-visit-notes-preview">
              {notes?.trim() ? notes : "No notes."}
            </span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden
          className={`mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div id={panelId} className="border-t border-slate-700/60 px-4 pb-4 pt-3" data-testid="past-visit-details">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Patient">
              {visit.patient_name?.trim() || "—"}
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
        </div>
      ) : null}
    </li>
  );
}

/**
 * Her past visits, newest first (user, 2026-10-09). A card opens to the patient's details, the
 * reason, the service and her notes, which she can edit there.
 */
export function PastVisitsList({
  visits,
  clinicNames,
}: {
  visits: PastVisitRow[];
  /** Clinic names by `clinics.id`; empty with a single clinic (nothing to tell apart). */
  clinicNames: Record<string, string>;
}) {
  const [notes, setNotes] = React.useState<Record<string, string | null>>({});
  const onNotesSaved = React.useCallback((id: string, value: string | null) => {
    setNotes((prev) => ({ ...prev, [id]: value }));
  }, []);

  return (
    <ul className="space-y-3" data-testid="past-visits-list">
      {visits.map((v) => (
        <VisitCard
          key={v.id}
          visit={v}
          clinicName={v.clinic_id ? (clinicNames[v.clinic_id] ?? null) : null}
          notes={v.id in notes ? notes[v.id] : v.professional_notes}
          onNotesSaved={onNotesSaved}
        />
      ))}
    </ul>
  );
}
