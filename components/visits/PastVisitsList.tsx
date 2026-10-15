"use client";

import * as React from "react";
import Link from "next/link";
import { History, Mail, PencilLine, Phone } from "lucide-react";
import { isNoShowAttendance } from "@/lib/appointment-attendance";
import { patientBirthdateLabel, patientSummaryParts } from "@/lib/patient-details";
import { patientVisitsHref, type PastVisitRow } from "@/lib/past-visits";
import {
  groupVisitsByMonth,
  visitBookingLabel,
  visitDateParts,
  visitTimeRange,
  type VisitClinicInfo,
} from "@/lib/past-visits-view";
import { VisitNotesBox } from "@/components/agenda/VisitNotesBox";
import { noteMissingNotesChange } from "@/components/visits/missing-notes-count";
import { UnsavedNotesPrompt } from "@/components/visits/UnsavedNotesPrompt";
import { setNotesUnsaved } from "@/components/visits/unsaved-notes";

/** A reason longer than this is cut to three lines behind a "More" link. */
const LONG_REASON = 160;

/**
 * One past visit, all of it on the card (user, 2026-10-13): the visit and the patient on the
 * left, her notes on the right (below, on a phone). Nothing unfolds except the notes box, from
 * its own "Add notes" / "Edit" button.
 */
function VisitCard({
  visit,
  clinic,
  showClinicColour,
  patientVisitCount,
  notes,
  onNotesSaved,
}: {
  visit: PastVisitRow;
  clinic: VisitClinicInfo | null;
  showClinicColour: boolean;
  /** Her past visits with this patient, this one included; null when there is nothing to match on. */
  patientVisitCount: number | null;
  notes: string | null;
  onNotesSaved: (id: string, notes: string | null) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [reasonOpen, setReasonOpen] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const visitId = visit.id;
  const onDirtyChange = React.useCallback(
    (value: boolean) => {
      setDirty(value);
      setNotesUnsaved(visitId, value ? () => setEditing(false) : null);
    },
    [visitId],
  );
  const notesRef = React.useRef<HTMLDivElement>(null);
  // The cursor goes straight into the box she asked for.
  React.useEffect(() => {
    if (editing) notesRef.current?.querySelector("textarea")?.focus();
  }, [editing]);

  const when = visitDateParts(visit.appointment_datetime);
  const name = visit.patient_name?.trim() || "Patient";
  const noShow = isNoShowAttendance(visit.attendance);
  const hasNotes = Boolean(notes?.trim());
  // Age and gender; "First visit" is the chip beside the name.
  const patientLine = patientSummaryParts({ birthdate: visit.patient_birthdate, gender: visit.patient_gender }).join(" · ");
  const historyHref = patientVisitsHref(visit);
  const booked = visitBookingLabel(visit.booking_source);
  const reason = visit.reason?.trim() ?? "";
  const longReason = reason.length > LONG_REASON;

  return (
    <li
      data-testid="past-visit"
      data-visit-id={visit.id}
      className={`overflow-hidden rounded-3xl border bg-pro-card shadow-xl shadow-black/20 transition ${
        editing ? "border-clinical-500/40" : "border-pro-line/70"
      }`}
    >
      <div
        data-testid="past-visit-details"
        className="grid gap-x-6 gap-y-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
      >
        <div className="flex min-w-0 items-start gap-4">
          <div aria-hidden className="flex w-12 shrink-0 flex-col items-center pt-0.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-clinical-300">{when.month}</span>
            <span className="mt-0.5 text-2xl font-semibold leading-none tabular-nums text-slate-50">{when.day}</span>
            <span className="mt-1 text-[11px] text-slate-400">{when.weekday}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-base font-semibold text-slate-50" data-testid="past-visit-patient">
                {name}
              </span>
              {visit.is_new_patient === true ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                  First visit
                </span>
              ) : null}
              {noShow ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                  No-show
                </span>
              ) : null}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold tabular-nums text-slate-200">
                {visitTimeRange(visit.appointment_datetime, visit.duration_minutes)}
              </span>
              {clinic ? (
                <span
                  data-testid="past-visit-clinic"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-pro-line/80 bg-pro-raised/70 px-1.5 py-0.5 text-[11px] font-semibold text-slate-200"
                >
                  {showClinicColour ? <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${clinic.swatch}`} /> : null}
                  <span className="truncate">{clinic.name}</span>
                </span>
              ) : null}
              {booked ? <span className="text-xs text-slate-500">{booked}</span> : null}
            </div>

            {visit.service_name || reason ? (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-slate-300">
                {visit.service_name ? (
                  <span className="rounded-full bg-clinical-500/15 px-2.5 py-0.5 text-xs font-semibold text-clinical-200">
                    {visit.service_name}
                  </span>
                ) : null}
                {reason ? (
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-500">Reason</span>
                    <span>
                      <span
                        data-testid="past-visit-reason"
                        className={`whitespace-pre-wrap ${longReason && !reasonOpen ? "line-clamp-3" : ""}`}
                      >
                        {reason}
                      </span>
                      {longReason ? (
                        <button
                          type="button"
                          onClick={() => setReasonOpen((v) => !v)}
                          aria-expanded={reasonOpen}
                          className="mt-0.5 text-xs font-medium text-clinical-200 hover:underline"
                        >
                          {reasonOpen ? "Less" : "More"}
                        </button>
                      ) : null}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {patientLine ? (
                <span className="text-slate-400" title={patientBirthdateLabel(visit.patient_birthdate) ?? undefined}>
                  {patientLine}
                </span>
              ) : null}
              {visit.patient_phone ? (
                <a
                  href={`tel:${visit.patient_phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex items-center gap-1.5 text-clinical-200 hover:underline"
                >
                  <Phone aria-hidden className="h-3.5 w-3.5 text-slate-500" />
                  {visit.patient_phone}
                </a>
              ) : null}
              {visit.patient_email ? (
                <a
                  href={`mailto:${visit.patient_email}`}
                  className="inline-flex min-w-0 items-center gap-1.5 text-clinical-200 hover:underline"
                >
                  <Mail aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">{visit.patient_email}</span>
                </a>
              ) : null}
            </div>

            {historyHref ? (
              <Link
                href={historyHref}
                data-testid="past-visit-patient-history"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-clinical-200 hover:underline"
              >
                <History aria-hidden className="h-3.5 w-3.5" />
                All visits with this patient
                {patientVisitCount ? <span data-testid="past-visit-patient-count">({patientVisitCount})</span> : null}
              </Link>
            ) : null}
          </div>
        </div>

        <div
          ref={notesRef}
          className="min-w-0 border-t border-pro-line/70 pt-3 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
        >
          {editing ? (
            <>
              {/* VisitNotesBox brings its own top margin for the agenda's dialog. */}
              <div className="-mt-4">
                <VisitNotesBox
                  appointmentId={visit.id}
                  initialNotes={notes}
                  onSaved={(n) => {
                    const has = Boolean(n?.trim());
                    if (has !== hasNotes) noteMissingNotesChange(has ? -1 : 1);
                    onNotesSaved(visit.id, n);
                  }}
                  onDirtyChange={onDirtyChange}
                />
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="mt-2 text-xs font-medium text-slate-400 transition hover:text-slate-100"
              >
                {dirty ? "Discard changes" : "Close"}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Your notes</span>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  data-testid="past-visit-notes-edit"
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-clinical-400/40 px-3 text-xs font-medium text-clinical-100 transition hover:border-clinical-400/70 hover:bg-clinical-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/50"
                >
                  <PencilLine aria-hidden className="h-3.5 w-3.5" />
                  {hasNotes ? "Edit" : "Add notes"}
                </button>
              </div>
              <p
                data-testid="past-visit-notes-preview"
                className={`mt-1.5 text-sm ${hasNotes ? "line-clamp-3 whitespace-pre-wrap text-slate-200" : "text-slate-500"}`}
              >
                {hasNotes ? notes : "No notes yet."}
              </p>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Her past visits, newest first, under month headings (user, 2026-10-12). A card shows the
 * visit, the patient and her notes, which she can edit there.
 */
export function PastVisitsList({
  visits,
  clinics,
  showClinicColours,
  patientVisitCounts,
}: {
  visits: PastVisitRow[];
  /** By `clinics.id`: every clinic of these visits, also one she has since left. */
  clinics: Record<string, VisitClinicInfo>;
  /** The clinic chip's coloured dot tells clinics apart: only with more than one. */
  showClinicColours: boolean;
  /** By visit id (lib/past-visits-view `patientVisitCounts`). */
  patientVisitCounts: Record<string, number>;
}) {
  const [notes, setNotes] = React.useState<Record<string, string | null>>({});
  const onNotesSaved = React.useCallback((id: string, value: string | null) => {
    setNotes((prev) => ({ ...prev, [id]: value }));
  }, []);

  return (
    <div className="space-y-6" data-testid="past-visits-list">
      <UnsavedNotesPrompt />
      {groupVisitsByMonth(visits).map((group) => (
        <section key={group.key} aria-labelledby={`month-${group.key}`}>
          <h2
            id={`month-${group.key}`}
            data-testid="past-visits-month"
            className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-slate-400"
          >
            {group.label}
            <span aria-hidden className="h-px flex-1 bg-white/10" />
          </h2>
          <ul className="space-y-3">
            {group.visits.map((v) => (
              <VisitCard
                key={v.id}
                visit={v}
                clinic={v.clinic_id ? (clinics[v.clinic_id] ?? null) : null}
                showClinicColour={showClinicColours}
                patientVisitCount={patientVisitCounts[v.id] ?? null}
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
