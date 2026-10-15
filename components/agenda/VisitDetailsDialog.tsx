"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { enGB } from "date-fns/locale";
import { Loader2, Phone, Trash2, X } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { isManualBooking, MANUAL_BOOKING_LABEL as MANUAL_MARK_LABEL } from "@/lib/agenda-booking-source";
import {
  appointmentTimeLabelCyprus,
  CY_TZ,
  isRescheduleProposalLive,
  isVisitSlotEnded,
} from "@/lib/appointments";
import { APPOINTMENT_ATTENDANCE_NO_SHOW, isNoShowAttendance } from "@/lib/appointment-attendance";
import { cancelConfirmedVisitCopy } from "@/lib/cancel-visit-copy";
import { emitNavigationStart } from "@/lib/doccy-navigation";
import { professionalCancelIsShortNotice } from "@/lib/patient-cancel-window";
import type { AgendaAppointmentRow, VisitDetails } from "@/lib/visit-details";
import { AgendaPreviousVisits } from "@/components/agenda/AgendaPreviousVisits";
import { VisitNotesBox } from "@/components/agenda/VisitNotesBox";
import { PatientDetails } from "@/components/dashboard/PatientDetails";
import { visitPurpose } from "@/lib/visit-purpose";

function firstNameOf(fullName: string | null | undefined): string {
  return String(fullName ?? "").trim().split(/\s+/)[0] || "the patient";
}

/**
 * One visit's details and actions: patient, reason, attendance, notes, cancel or decline,
 * previous visits. Opened from the agenda and from the dashboard's today list
 * (user, 2026-10-09); the opener keeps its own list in step through onUpdated / onRemoved.
 */
export function VisitDetailsDialog({
  visit,
  clinicName,
  clinicSwatchClass,
  previousVisitClinicName,
  patientCancelNoticeHours,
  agendaHref,
  onClose,
  onUpdated,
  onRemoved,
}: {
  visit: VisitDetails;
  /** The visit's clinic, when the professional has more than one. */
  clinicName: string | null;
  clinicSwatchClass: string | null;
  previousVisitClinicName: (clinicId: string | null | undefined) => string | null;
  patientCancelNoticeHours: number;
  /** Opened outside the agenda: a link to the visit there. */
  agendaHref?: string;
  onClose: () => void;
  onUpdated: (id: string, patch: Partial<AgendaAppointmentRow>) => void;
  /** Declined or cancelled: the visit leaves the opener's list. */
  onRemoved: (id: string) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<VisitDetails>(visit);
  const [openingReview, setOpeningReview] = React.useState(false);
  const [confirmingCancel, setConfirmingCancel] = React.useState(false);
  const [cancelMode, setCancelMode] = React.useState<null | "confirmed" | "requested">(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [markingAttendance, setMarkingAttendance] = React.useState(false);
  const [attendanceError, setAttendanceError] = React.useState<string | null>(null);
  const modalBusy = isCancelling || openingReview || markingAttendance;

  const nowMs = Date.now();
  const selectedStatus = String(selected.status ?? "").toUpperCase();
  const purpose = visitPurpose({ serviceName: selected.service_name, reason: selected.reason });
  const selectedPast = isVisitSlotEnded(
        selected.gridStartIso,
        selected.rowDurationMinutes,
        nowMs,
      );
  const selectedProposalLive = isRescheduleProposalLive(
        selected.status,
        selected.proposal_expires_at,
        nowMs,
      );
  const selectedNoShow = isNoShowAttendance(selected.attendance);
  const selectedStarted = new Date(selected.appointment_datetime).getTime() <= nowMs;
  // Attendance is fixed once the review email has gone out (user, 2026-10-04).
  const selectedReviewSent = Boolean(selected.review_requested_at);

  // Cancel dialog for a confirmed visit: email promise only when there is an email (F4).
  const cancelCopy = cancelConfirmedVisitCopy({ patientEmail: selected.patient_email, patientPhone: selected.patient_phone });

  async function handleCancelAppointment() {
    if (!cancelMode) return;
    const selectedId = selected.id;
    setCancelError(null);
    setIsCancelling(true);
    try {
      if (cancelMode === "requested") {
        const reason = rejectReason.trim();
        if (reason.length < 10) {
          setCancelError("Please enter a reason (at least 10 characters).");
          setIsCancelling(false);
          return;
        }
        const res = await fetch(
          `/api/appointments/${encodeURIComponent(selectedId)}/reject`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const message = data?.message || "We could not decline this request.";
          setCancelError(message);
          sonnerToast.error(message);
          setIsCancelling(false);
          return;
        }
        sonnerToast.success(
          "Your message was sent to the patient by email and the request was removed from your agenda.",
        );
      } else {
        const reason = rejectReason.trim();
        if (reason.length < 10) {
          setCancelError("Please enter a reason (at least 10 characters).");
          setIsCancelling(false);
          return;
        }
        const res = await fetch(
          `/api/appointments/${encodeURIComponent(selectedId)}/cancel-confirmed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          },
        );
        const data = (await res.json().catch(() => null)) as {
          message?: string;
          patientHasEmail?: boolean;
          patientPhone?: string | null;
        } | null;
        if (!res.ok) {
          const message =
            data?.message || "We could not cancel this appointment.";
          setCancelError(message);
          sonnerToast.error(message);
          setIsCancelling(false);
          return;
        }
        if (data?.patientHasEmail === false) {
          // No email on file: nobody told the patient yet (user, 2026-10-04).
          sonnerToast.warning(
            `Visit cancelled. This patient has no email: please call them${
              data.patientPhone ? ` on ${data.patientPhone}` : ""
            } to let them know.`,
            { duration: 20_000 },
          );
        } else {
          sonnerToast.success(
            "The patient was emailed about the cancellation and the visit was removed from your agenda.",
          );
        }
      }
      setIsCancelling(false);
      onRemoved(selectedId);
    } catch (err) {
      console.error(err);
      const message = "Something went wrong. Please try again.";
      setCancelError(message);
      sonnerToast.error(message);
      setIsCancelling(false);
    }
  }

  async function setAttendanceNoShow(markNoShow: boolean) {
    if (markingAttendance) return;
    setAttendanceError(null);
    setMarkingAttendance(true);
    const selectedId = selected.id;
    try {
      const res = await fetch(
        `/api/appointments/${encodeURIComponent(selectedId)}/attendance`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attendance: markNoShow ? APPOINTMENT_ATTENDANCE_NO_SHOW : null,
          }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAttendanceError(
          typeof data?.message === "string"
            ? data.message
            : "Could not save attendance.",
        );
        return;
      }
      const nextAttendance = markNoShow ? APPOINTMENT_ATTENDANCE_NO_SHOW : null;
      onUpdated(selectedId, { attendance: nextAttendance });
      setSelected((prev) => ({ ...prev, attendance: nextAttendance }));
    } catch {
      setAttendanceError("Something went wrong. Please try again.");
    } finally {
      setMarkingAttendance(false);
    }
  }

  // Her visit notes with text not saved yet: closing the visit asks first.
  const notesDirtyRef = React.useRef(false);
  const [discardPrompt, setDiscardPrompt] = React.useState(false);
  const setNotesDirty = React.useCallback((dirty: boolean) => {
    notesDirtyRef.current = dirty;
    if (!dirty) setDiscardPrompt(false);
  }, []);
  /** Closes the visit window; with unsaved notes it first asks, inside the window. */
  function closeVisitDialog(discardNotes = false) {
    if (modalBusy) return;
    if (!discardNotes && notesDirtyRef.current) {
      setDiscardPrompt(true);
      return;
    }
    notesDirtyRef.current = false;
    setDiscardPrompt(false);
    onClose();
  }

  function openCancelFlow() {
    const su = String(selected.status ?? "").toUpperCase();
    if (su === "NEEDS_RESCHEDULE") return;
    const past = isVisitSlotEnded(selected.gridStartIso, selected.rowDurationMinutes, nowMs);
    if (past && su !== "REQUESTED") return;
    setCancelError(null);
    setRejectReason("");
    setCancelMode(su === "REQUESTED" ? "requested" : "confirmed");
    setConfirmingCancel(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4"
      aria-modal="true"
      role="dialog"
    >
      <button
        type="button"
        onClick={() => closeVisitDialog()}
        className="absolute inset-0 bg-ink-900/70 backdrop-blur-sm"
        aria-label="Close"
        disabled={modalBusy}
      />
      <div className="relative z-10 w-full max-w-sm max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl border border-clinical-100/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl sm:max-h-[calc(100dvh-2rem)]">
        <button
          type="button"
          onClick={() => closeVisitDialog()}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Close"
          disabled={modalBusy}
        >
          <X className="h-5 w-5" />
        </button>
        <h3 className="pr-8 text-lg font-semibold text-slate-50">
          {selected.patient_name}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-slate-400">
          <span>
            {selected.dateLabel} · {selected.timeLabel}
          </span>
          {clinicName ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-[2px] ${clinicSwatchClass ?? ""}`}
                aria-hidden
              />
              {clinicName}
            </span>
          ) : null}
          {agendaHref ? (
            <Link href={agendaHref} className="font-semibold text-clinical-300 hover:text-clinical-200">
              Open in agenda
            </Link>
          ) : null}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {selected.isExpired ? (
            <p className="inline-flex rounded-full border border-slate-600/80 bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              Expired request
            </p>
          ) : selectedPast ? (
            <p className="inline-flex rounded-full border border-slate-600/80 bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              Past visit
            </p>
          ) : null}
          {isManualBooking(selected.booking_source) ? (
            <p
              data-testid="agenda-visit-manual"
              className="inline-flex items-center gap-1 rounded-full border border-clinical-400/30 bg-clinical-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-clinical-200"
            >
              <Phone className="h-3 w-3" aria-hidden />
              {MANUAL_MARK_LABEL} · added by you
            </p>
          ) : null}
          {selectedNoShow ? (
            <p className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
              No-show
            </p>
          ) : null}
        </div>
        {/* Who the patient is (user, 2026-10-06). */}
        <PatientDetails
          testId="agenda-visit-patient"
          className="mt-3"
          birthdate={selected.patient_birthdate}
          gender={selected.patient_gender}
          isNewPatient={selected.is_new_patient}
          phone={selected.patient_phone}
          email={selected.patient_email}
        />
        {purpose.service ? (
          <div className="mt-3 rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Service</p>
            <p data-testid="visit-details-service" className="mt-1 text-sm font-semibold text-slate-100">
              {purpose.service}
            </p>
          </div>
        ) : null}
        {purpose.service && !purpose.reason ? null : (
        <div className="mt-3 rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Reason for visit
          </p>
          <p
            className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${
              selected.reason ? "text-slate-200" : "text-amber-300"
            }`}
          >
            {purpose.reason || "Missing reason (data issue)."}
          </p>
        </div>
        )}
        {selected.isCounterOfferHold &&
        String(selected.status ?? "").toUpperCase() ===
          "NEEDS_RESCHEDULE" ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Patient originally requested{" "}
            {formatInTimeZone(
              new Date(selected.appointment_datetime),
              CY_TZ,
              "dd/MM/yyyy",
              { locale: enGB },
            )}{" "}
            · {appointmentTimeLabelCyprus(selected.appointment_datetime)}
          </p>
        ) : null}
        {selected.isExpired && !confirmingCancel ? (
          <div className="mt-4" data-testid="agenda-expired-request">
            <p className="text-sm leading-relaxed text-slate-300">
              This request expired: nobody answered it before the visit time. We let{" "}
              {firstNameOf(selected.patient_name)} know they can book again online.
            </p>
          </div>
        ) : null}
        {selectedPast &&
        !selected.isExpired &&
        !confirmingCancel ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm leading-relaxed text-slate-400">
              {selectedStatus === "REQUESTED"
                ? "This request was not confirmed before the visit time."
                : selectedStatus === "NEEDS_RESCHEDULE" &&
                    !selectedProposalLive
                  ? "The patient did not choose a new time before the offer expired."
                  : selectedStatus === "CONFIRMED" && selectedNoShow
                    ? "You marked this visit as a no-show."
                    : selectedStatus === "CONFIRMED" && selectedReviewSent
                      ? "This visit counts as attended. The patient has been asked for a review."
                      : selectedStatus === "CONFIRMED"
                      ? "This visit counts as attended. If the patient didn't come, mark a no-show."
                      : "This visit is in the past. Details are read-only."}
            </p>
            {selectedStatus === "CONFIRMED" && !selectedReviewSent ? (
              selectedNoShow ? (
                <button
                  type="button"
                  onClick={() => {
                    void setAttendanceNoShow(false);
                  }}
                  disabled={markingAttendance}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-600 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {markingAttendance ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Updating…
                    </>
                  ) : (
                    "Undo no-show"
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void setAttendanceNoShow(true);
                  }}
                  disabled={markingAttendance}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm font-medium text-amber-100 transition hover:border-amber-400/50 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {markingAttendance ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    "Mark as no-show"
                  )}
                </button>
              )
            ) : null}
            {attendanceError ? (
              <p className="text-xs text-amber-300">{attendanceError}</p>
            ) : null}
          </div>
        ) : null}
        {selectedStatus === "CONFIRMED" && selectedStarted && !confirmingCancel ? (
          <VisitNotesBox
            appointmentId={selected.id}
            initialNotes={selected.professional_notes ?? null}
            onDirtyChange={setNotesDirty}
            onSaved={(notes) => {
              const id = selected.id;
              onUpdated(id, { professional_notes: notes });
              setSelected((prev) => ({ ...prev, professional_notes: notes }));
            }}
          />
        ) : null}
        {discardPrompt ? (
          <div
            role="alertdialog"
            aria-label="Unsaved notes"
            data-testid="discard-notes-prompt"
            className="mt-3 rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2.5"
          >
            <p className="text-sm text-slate-200">You have notes that are not saved yet.</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setDiscardPrompt(false)}
                className="flex-1 rounded-xl border border-clinical-500/40 bg-clinical-500/10 px-3 py-2 text-xs font-semibold text-clinical-200 transition hover:bg-clinical-500/20"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => closeVisitDialog(true)}
                className="flex-1 rounded-xl border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700/60"
              >
                Discard and close
              </button>
            </div>
          </div>
        ) : null}
        {selected.showReviewLink &&
        !selectedPast &&
        !confirmingCancel ? (
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              disabled={openingReview}
              aria-busy={openingReview}
              onClick={() => {
                if (openingReview) return;
                setOpeningReview(true);
                emitNavigationStart();
                router.push(`/dashboard/appointments/${selected.id}`);
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-clinical-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/30 transition hover:bg-clinical-300 disabled:cursor-wait disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
            >
              {openingReview ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Opening review…
                </>
              ) : (
                "Review & confirm request"
              )}
            </button>
            <button
              type="button"
              onClick={() => openCancelFlow()}
              disabled={openingReview}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-red-500/30 px-3 py-2 text-sm font-medium text-red-300 transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Decline request
            </button>
          </div>
        ) : selectedStatus === "NEEDS_RESCHEDULE" &&
          !selectedPast &&
          selectedProposalLive &&
          !confirmingCancel ? (
          <p className="mt-3 text-sm text-amber-200/90">
            Waiting for the patient to choose one of the proposed times.
          </p>
        ) : selectedStatus === "NEEDS_RESCHEDULE" &&
          !selectedProposalLive &&
          !confirmingCancel ? (
          <p className="mt-3 text-sm text-slate-400">
            The patient didn&apos;t choose a new time in time. Nothing is booked.
          </p>
        ) : null}
        {selectedStatus === "CONFIRMED" &&
        !selectedPast &&
        !confirmingCancel ? (
          <div className="mt-6 flex flex-col gap-2">
            {/* A confirmed visit can't be moved, only cancelled (user, 2026-10-04). */}
            <button
              type="button"
              onClick={() => openCancelFlow()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-red-500/30 px-3 py-2 text-sm font-medium text-red-300 transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Cancel appointment
            </button>
          </div>
        ) : null}

        {confirmingCancel && cancelMode ? (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-slate-300">
            {cancelMode === "requested" ? (
              <>
                <p>
                  The patient will receive an email with your message and a
                  link to book again on your profile.
                </p>
                <label className="mt-3 block text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Reason (required)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. A last-minute surgery came up and I need to free this slot — sorry. Please book another time on my profile."
                  rows={4}
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-clinical-500/50 focus:outline-none focus:ring-1 focus:ring-clinical-500/40"
                  disabled={isCancelling}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  At least 10 characters.
                </p>
              </>
            ) : (
              <>
                <p>{cancelCopy?.intro}</p>
                {cancelCopy?.call ? (
                  <a
                    href={cancelCopy.call.href}
                    data-testid="cancel-call-patient"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-clinical-300 hover:text-clinical-200"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                    {cancelCopy.call.label}
                  </a>
                ) : null}
                {selected &&
                professionalCancelIsShortNotice(
                  selected.appointment_datetime,
                  patientCancelNoticeHours,
                ) ? (
                  <p
                    className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-100"
                    data-testid="cancel-short-notice"
                  >
                    This is short notice for the patient: the visit is in less than{" "}
                    {patientCancelNoticeHours} hours.
                  </p>
                ) : null}
                <label className="mt-3 block text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {cancelCopy?.notifiesByEmail === false ? "Reason (kept with the visit)" : "Reason (required)"}
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={
                    cancelCopy?.notifiesByEmail === false
                      ? "e.g. Emergency at the hospital; I called the patient to book another day."
                      : "e.g. An emergency procedure requires me to be elsewhere — I’m very sorry to cancel this confirmed slot. Please book again on my profile when you can."
                  }
                  rows={4}
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-clinical-500/50 focus:outline-none focus:ring-1 focus:ring-clinical-500/40"
                  disabled={isCancelling}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  At least 10 characters.
                </p>
              </>
            )}
            <div className="sticky bottom-0 -mx-3 mt-3 border-t border-slate-700/90 bg-slate-900/95 px-3 pb-2 pt-2 backdrop-blur">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingCancel(false);
                    setCancelMode(null);
                    setRejectReason("");
                    setCancelError(null);
                  }}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
                >
                  {cancelMode === "requested" ? "Go back" : "Keep appointment"}
                </button>
                <button
                  type="button"
                  disabled={isCancelling || rejectReason.trim().length < 10}
                  onClick={handleCancelAppointment}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:border-red-400/60 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isCancelling
                    ? cancelMode === "requested"
                      ? "Declining…"
                      : "Cancelling…"
                    : cancelMode === "requested"
                      ? "Decline & notify"
                      : (cancelCopy?.confirmLabel ?? "Cancel & notify")}
                </button>
              </div>
            </div>
            {cancelError ? (
              <p className="mt-2 text-xs text-red-300">{cancelError}</p>
            ) : null}
          </div>
        ) : null}
        {["REQUESTED", "CONFIRMED"].includes(String(selected.status ?? "").toUpperCase()) && !confirmingCancel ? (
          <AgendaPreviousVisits
            patientName={selected.patient_name}
            appointmentId={selected.id}
            clinicName={previousVisitClinicName}
          />
        ) : null}
      </div>
    </div>
  );
}
