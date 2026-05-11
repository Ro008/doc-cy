"use client";

import * as React from "react";
import { addDays, addHours, format } from "date-fns";
import { enGB } from "date-fns/locale";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { CalendarPlus, Loader2, Plus, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CY_TZ } from "@/lib/appointments";
import type { WeeklySchedule } from "@/lib/doctor-settings";
import { APPOINTMENT_REASON_MAX_LENGTH } from "@/lib/visit-types";
import { WhatsAppLogoIcon } from "@/components/icons/WhatsAppLogoIcon";
import { buildWhatsAppMessageLink } from "@/lib/whatsapp";
import "react-day-picker/dist/style.css";

type AgendaAppointmentRow = {
  id: string;
  appointment_datetime: string;
  status?: string | null;
};

type AgendaWorkingHours = {
  weeklySchedule: WeeklySchedule;
  breakStart: string | null;
  breakEnd: string | null;
  slotDurationMinutes: number;
};

type SlotOption = {
  key: string;
  date: Date;
  dateKey: string;
  labelTime: string;
  labelFull: string;
  slotKey: string;
};

type ManualBookingFlowProps = {
  open: boolean;
  doctorId: string | null;
  doctorSlug?: string | null;
  appointments: AgendaAppointmentRow[];
  workingHours: AgendaWorkingHours | null;
  onClose: () => void;
  onBooked: () => void;
};

type SuccessState = {
  appointmentId: string;
  patientName: string;
  patientPhone: string;
  dateLabel: string;
  timeLabel: string;
  googleCalendarUrl: string;
  iCalUrl: string;
  profileUrl: string | null;
};

const HORIZON_DAYS = 90;
const MINIMUM_NOTICE_HOURS = 2;

function isBlockingStatus(status: string | null | undefined): boolean {
  const upper = String(status ?? "").toUpperCase();
  return (
    upper === "REQUESTED" || upper === "CONFIRMED" || upper === "NEEDS_RESCHEDULE"
  );
}

function dayKeyForDate(d: Date): keyof WeeklySchedule {
  const map: Array<keyof WeeklySchedule> = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return map[d.getDay()];
}

export function ManualBookingFlow({
  open,
  doctorId,
  doctorSlug,
  appointments,
  workingHours,
  onClose,
  onBooked,
}: ManualBookingFlowProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<SlotOption | null>(null);
  const [patientName, setPatientName] = React.useState("");
  const [patientPhone, setPatientPhone] = React.useState("");
  const [patientEmail, setPatientEmail] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<SuccessState | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSelectedDate(null);
    setSelectedSlot(null);
    setPatientName("");
    setPatientPhone("");
    setPatientEmail("");
    setReason("");
    setError(null);
    setSuccess(null);
    setSubmitting(false);
  }, [open]);

  const slotDuration =
    workingHours?.slotDurationMinutes && workingHours.slotDurationMinutes > 0
      ? workingHours.slotDurationMinutes
      : 30;

  const takenSet = React.useMemo(() => {
    const set = new Set<string>();
    appointments.forEach((a) => {
      if (!isBlockingStatus(a.status)) return;
      const cy = utcToZonedTime(new Date(a.appointment_datetime), CY_TZ);
      const key = format(cy, "yyyy-MM-dd'T'HH:mm");
      set.add(key);
    });
    return set;
  }, [appointments]);

  const upcomingSlots = React.useMemo(() => {
    if (!workingHours) return [] as SlotOption[];
    const out: SlotOption[] = [];
    const nowUtc = new Date();
    const nowCy = utcToZonedTime(nowUtc, CY_TZ);
    const nowCyKey = format(nowCy, "yyyy-MM-dd");
    const nowCyTime = format(nowCy, "HH:mm");
    const minimumNoticeCutoff = addHours(nowUtc, MINIMUM_NOTICE_HOURS);

    for (let offset = 0; offset <= HORIZON_DAYS; offset += 1) {
      const day = addDays(nowCy, offset);
      const dayKey = format(day, "yyyy-MM-dd");
      const dayCfg = workingHours.weeklySchedule[dayKeyForDate(day)];
      if (!dayCfg?.enabled) continue;

      const [startHour, startMinute] = String(dayCfg.start_time ?? "09:00")
        .split(":")
        .map(Number);
      const [endHour, endMinute] = String(dayCfg.end_time ?? "17:00")
        .split(":")
        .map(Number);

      let cursorMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      while (cursorMinutes < endMinutes) {
        const hh = String(Math.floor(cursorMinutes / 60)).padStart(2, "0");
        const mm = String(cursorMinutes % 60).padStart(2, "0");
        const hhmm = `${hh}:${mm}`;
        const slotKey = `${dayKey}T${hhmm}`;

        if (dayKey === nowCyKey && hhmm < nowCyTime) {
          cursorMinutes += slotDuration;
          continue;
        }

        if (
          workingHours.breakStart &&
          workingHours.breakEnd &&
          hhmm >= workingHours.breakStart &&
          hhmm < workingHours.breakEnd
        ) {
          cursorMinutes += slotDuration;
          continue;
        }

        const utcDate = zonedTimeToUtc(`${dayKey}T${hhmm}:00`, CY_TZ);
        if (utcDate.getTime() < minimumNoticeCutoff.getTime()) {
          cursorMinutes += slotDuration;
          continue;
        }

        const cyDate = utcToZonedTime(utcDate, CY_TZ);
        out.push({
          key: utcDate.toISOString(),
          date: utcDate,
          dateKey: dayKey,
          labelTime: hhmm,
          labelFull: format(cyDate, "EEE d MMM, HH:mm", { locale: enGB }),
          slotKey,
        });
        cursorMinutes += slotDuration;
      }
    }

    return out;
  }, [workingHours, slotDuration]);

  const availableDates = React.useMemo(() => {
    const set = new Set<string>();
    upcomingSlots.forEach((slot) => {
      if (!takenSet.has(slot.slotKey)) {
        set.add(slot.dateKey);
      }
    });
    return Array.from(set).map((d) => {
      const [y, m, day] = d.split("-").map(Number);
      return new Date(y, m - 1, day);
    });
  }, [upcomingSlots, takenSet]);

  const slotsForSelectedDay = React.useMemo(() => {
    if (!selectedDate) return [];
    const dayKey = format(selectedDate, "yyyy-MM-dd");
    return upcomingSlots.filter(
      (slot) => slot.dateKey === dayKey && !takenSet.has(slot.slotKey),
    );
  }, [selectedDate, upcomingSlots, takenSet]);

  const isDateAvailable = React.useCallback(
    (date: Date) =>
      availableDates.some(
        (candidate) => format(candidate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd"),
      ),
    [availableDates],
  );

  async function handleConfirmBooking() {
    setError(null);
    if (!doctorId) {
      setError("Doctor account not available.");
      return;
    }
    if (!selectedSlot) {
      setError("Please select a time slot.");
      return;
    }
    if (!patientName.trim()) {
      setError("Patient name is required.");
      return;
    }
    const reasonTrimmed = reason.slice(0, APPOINTMENT_REASON_MAX_LENGTH).trim();
    if (!reasonTrimmed) {
      setError("Reason for visit is required.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/appointments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: patientName.trim(),
          patientPhone: patientPhone.trim(),
          patientEmail: patientEmail.trim(),
          appointmentLocal: selectedSlot.slotKey,
          reason: reasonTrimmed,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          (data as { message?: string } | null)?.message ??
            "Could not create manual booking.",
        );
        return;
      }

      setSuccess({
        appointmentId: String((data as { appointment?: { id?: string } }).appointment?.id ?? ""),
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        dateLabel: format(selectedSlot.date, "dd/MM/yyyy"),
        timeLabel: selectedSlot.labelTime,
        googleCalendarUrl: String(
          (data as { links?: { googleCalendarUrl?: string } }).links
            ?.googleCalendarUrl ?? "",
        ),
        iCalUrl: String((data as { links?: { iCalUrl?: string } }).links?.iCalUrl ?? ""),
        profileUrl:
          (data as { links?: { profileUrl?: string | null } }).links?.profileUrl ??
          (doctorSlug ? `/${doctorSlug}` : null),
      });
      onBooked();
    } catch {
      setError("Could not create manual booking.");
    } finally {
      setSubmitting(false);
    }
  }

  const whatsappLink = React.useMemo(() => {
    if (!success) return null;
    const msg = `Hi ${success.patientName}, your appointment is confirmed for ${success.dateLabel} at ${success.timeLabel}. For future bookings, you can see my real-time availability and book directly here: ${success.profileUrl ?? ""}. See you soon!`;
    return buildWhatsAppMessageLink(msg, success.patientPhone || null);
  }, [success]);

  if (!open) return null;

  return (
    <div
      data-testid="manual-booking-modal-root"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-4"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        aria-label="Close manual booking modal"
      />
      <div
        data-testid="manual-booking-modal-panel"
        className="relative z-10 my-2 w-full max-w-4xl max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-3xl border border-emerald-100/10 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-xl sm:my-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {success ? (
          <div className="py-6">
            <h3
              data-testid="manual-booking-success-title"
              className="text-2xl font-bold tracking-tight text-slate-50"
            >
              Appointment Blocked!
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              {success.patientName} is now booked for {success.dateLabel} at{" "}
              {success.timeLabel} (Cyprus time).
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <a
                href={success.googleCalendarUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300"
              >
                <CalendarPlus className="h-4 w-4" />
                Add to Google
              </a>
              <a
                href={success.iCalUrl}
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition hover:border-emerald-400/60 hover:bg-emerald-400/20"
              >
                Add to iCal (.ics)
              </a>
              <a
                href={whatsappLink ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-400/40 bg-green-500/15 px-4 py-2.5 text-sm font-semibold text-green-100 transition hover:border-green-400/60 hover:bg-green-500/25"
              >
                <WhatsAppLogoIcon className="h-4 w-4" />
                Share Link via WhatsApp
              </a>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <h3
                data-testid="manual-booking-modal-title"
                className="text-xl font-semibold text-slate-50"
              >
                + Add Manual Booking
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Took a phone call? Block the slot manually here. Next time, share your link to
                save time.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800/60 bg-slate-950/30 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Date
                </p>
                <DayPicker
                  mode="single"
                  selected={selectedDate ?? undefined}
                  onSelect={(d) => {
                    setSelectedDate(d ?? null);
                    setSelectedSlot(null);
                  }}
                  fromDate={new Date()}
                  toDate={addDays(new Date(), HORIZON_DAYS)}
                  disabled={(date) => !isDateAvailable(date)}
                  locale={enGB}
                  captionLayout="buttons"
                  className="rdp-dark"
                  classNames={{
                    root: "p-0",
                    caption: "flex justify-between items-center mb-4",
                    caption_label: "text-sm font-semibold text-slate-200",
                    nav: "flex gap-1",
                    nav_button_previous:
                      "rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-300 hover:bg-slate-700/50",
                    nav_button_next:
                      "rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-300 hover:bg-slate-700/50",
                    month: "w-full",
                    day: "p-0.5 w-9 h-9 rounded-full text-sm font-medium transition",
                  }}
                  modifiers={{ available: availableDates }}
                  modifiersClassNames={{
                    available: "rdp-day_available",
                    selected: "rdp-day_selected",
                    disabled: "rdp-day_disabled",
                    today: "rdp-day_today",
                  }}
                  components={{
                    IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                    IconRight: () => <ChevronRight className="h-4 w-4" />,
                  }}
                />
              </div>

              <div className="rounded-2xl border border-slate-800/60 bg-slate-950/30 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Time
                </p>
                {!selectedDate ? (
                  <p className="py-6 text-sm text-slate-500">Select a date to view slots.</p>
                ) : slotsForSelectedDay.length === 0 ? (
                  <p className="py-6 text-sm text-slate-500">No available times this day.</p>
                ) : (
                  <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                    {slotsForSelectedDay.map((slot) => {
                      const isSelected = selectedSlot?.key === slot.key;
                      return (
                        <button
                          key={slot.key}
                          type="button"
                          onClick={() => setSelectedSlot(isSelected ? null : slot)}
                          className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                            isSelected
                              ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-100"
                              : "border-slate-800/80 bg-slate-900/40 text-slate-200 hover:border-emerald-400/30 hover:bg-emerald-400/5"
                          }`}
                        >
                          <span>{slot.labelTime}</span>
                          {isSelected ? <span className="text-xs">Selected</span> : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-200">
                  Patient Name <span className="text-red-300">*</span>
                </label>
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                  placeholder="Patient full name"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-200">Phone (optional)</label>
                <input
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  className="w-full rounded-2xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                  placeholder="+357..."
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-slate-200">Email (optional)</label>
              <input
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                placeholder="patient@email.com"
              />
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-slate-200">
                Reason for visit <span className="text-red-300">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value.slice(0, APPOINTMENT_REASON_MAX_LENGTH))
                }
                rows={3}
                className="w-full resize-y rounded-2xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                placeholder="Brief reason for this visit"
                required
              />
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmBooking}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Confirm Booking
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

