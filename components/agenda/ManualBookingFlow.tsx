"use client";

import * as React from "react";

import { MANUAL_BOOKING_HINT, MANUAL_BOOKING_LABEL } from "@/lib/manual-booking-copy";
import { addDays, addHours, format } from "date-fns";
import { enGB } from "date-fns/locale";
import { formatInTimeZone, utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { CalendarPlus, Loader2, Plus, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CY_TZ } from "@/lib/appointments";
import { dayBreakTimes, type WeeklySchedule } from "@/lib/doctor-settings";
import { type AgendaClinic, type AgendaWorkingHours } from "@/lib/agenda-clinics";
import {
  isManualBookingSlotTaken,
  withJustBooked,
  type ManualBookingAppointmentRow,
} from "@/lib/manual-booking-slots";
import { agendaClinicEventColor } from "@/lib/doctor-locations";
import { APPOINTMENT_REASON_MAX_LENGTH } from "@/lib/visit-types";
import { type PatientGender } from "@/lib/booking-patient-fields";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { manualPhoneProblem } from "@/lib/phone-number";
import {
  firstManualBookingError,
  type ManualBookingError,
  type ManualBookingField,
} from "@/lib/manual-booking-validation";
import "react-day-picker/dist/style.css";


type ManualBookingFlowProps = {
  open: boolean;
  doctorId: string | null;
  doctorSlug?: string | null;
  appointments: ManualBookingAppointmentRow[];
  workingHours: AgendaWorkingHours | null;
  clinics?: AgendaClinic[];
  preferredClinicId?: string | null;
  /** Her pro access has ended: nothing new can be booked (the route refuses too). */
  accessEnded?: boolean;
  onClose: () => void;
  onBooked: () => void;
};

type SlotOption = {
  key: string;
  date: Date;
  dateKey: string;
  labelTime: string;
  labelFull: string;
  slotKey: string;
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
  clinics = [],
  preferredClinicId = null,
  accessEnded = false,
  onClose,
  onBooked,
}: ManualBookingFlowProps) {
  const isMultiClinic = clinics.length > 1;
  const [selectedClinicId, setSelectedClinicId] = React.useState<string | null>(
    preferredClinicId ?? clinics[0]?.id ?? null,
  );
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<SlotOption | null>(null);
  const [patientName, setPatientName] = React.useState("");
  const [patientPhone, setPatientPhone] = React.useState("");
  /** From the phone box: same country-aware check as online booking. */
  const [phoneValid, setPhoneValid] = React.useState(false);
  const [patientEmail, setPatientEmail] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [isNewPatient, setIsNewPatient] = React.useState<boolean | null>(null);
  const [patientGender, setPatientGender] = React.useState<PatientGender | "">("");
  const [patientBirthdate, setPatientBirthdate] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** The first field to fix; its message shows under that field. */
  const [fieldError, setFieldError] = React.useState<ManualBookingError | null>(null);
  const errorFor = (field: ManualBookingField) => (fieldError?.field === field ? fieldError.message : null);
  const fixed = (field: ManualBookingField) =>
    setFieldError((current) => (current?.field === field ? null : current));
  const [success, setSuccess] = React.useState<SuccessState | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSelectedDate(null);
    setSelectedSlot(null);
    setPatientName("");
    setPatientPhone("");
    setPatientEmail("");
    setReason("");
    setIsNewPatient(null);
    setPatientGender("");
    setPatientBirthdate("");
    setError(null);
    setFieldError(null);
    setSuccess(null);
    setSubmitting(false);
    setSelectedClinicId(preferredClinicId ?? clinics[0]?.id ?? null);
  }, [open]);

  // Only the panel scrolls: freeze the page behind the modal.
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const selectedClinic =
    clinics.find((clinic) => clinic.id === selectedClinicId) ?? clinics[0] ?? null;
  const activeHours = selectedClinic?.hours ?? workingHours;

  const slotDuration =
    activeHours?.slotDurationMinutes && activeHours.slotDurationMinutes > 0
      ? activeHours.slotDurationMinutes
      : 30;

  // One professional, one agenda: a visit in any clinic blocks the time in all of them.
  // Times this modal just booked (or was just told are taken): hidden right away, without
  // waiting for the dashboard or agenda to refresh. Kept across openings of the modal.
  const [justBooked, setJustBooked] = React.useState<ManualBookingAppointmentRow[]>([]);
  const knownAppointments = React.useMemo(
    () => withJustBooked(appointments, justBooked),
    [appointments, justBooked],
  );
  const isSlotTaken = React.useCallback(
    (slot: SlotOption) => isManualBookingSlotTaken(slot.key, slotDuration, knownAppointments),
    [knownAppointments, slotDuration],
  );

  const upcomingSlots = React.useMemo(() => {
    if (!activeHours) return [] as SlotOption[];
    const out: SlotOption[] = [];
    const nowUtc = new Date();
    const nowCy = utcToZonedTime(nowUtc, CY_TZ);
    const nowCyKey = format(nowCy, "yyyy-MM-dd");
    const nowCyTime = format(nowCy, "HH:mm");
    const minimumNoticeCutoff = addHours(nowUtc, MINIMUM_NOTICE_HOURS);

    for (let offset = 0; offset <= HORIZON_DAYS; offset += 1) {
      const day = addDays(nowCy, offset);
      const dayKey = format(day, "yyyy-MM-dd");
      const dayCfg = activeHours.weeklySchedule[dayKeyForDate(day)];
      // That day's own break, or the clinic's one break for a day saved without its own.
      const dayBreak = dayBreakTimes(dayCfg, activeHours.breakStart, activeHours.breakEnd);
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

        if (dayBreak && hhmm >= dayBreak.start && hhmm < dayBreak.end) {
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
  }, [activeHours, slotDuration]);

  const availableDates = React.useMemo(() => {
    const set = new Set<string>();
    upcomingSlots.forEach((slot) => {
      if (!isSlotTaken(slot)) {
        set.add(slot.dateKey);
      }
    });
    return Array.from(set).map((d) => {
      const [y, m, day] = d.split("-").map(Number);
      return new Date(y, m - 1, day);
    });
  }, [upcomingSlots, isSlotTaken]);

  const slotsForSelectedDay = React.useMemo(() => {
    if (!selectedDate) return [];
    const dayKey = format(selectedDate, "yyyy-MM-dd");
    return upcomingSlots.filter(
      (slot) => slot.dateKey === dayKey && !isSlotTaken(slot),
    );
  }, [selectedDate, upcomingSlots, isSlotTaken]);

  const isDateAvailable = React.useCallback(
    (date: Date) =>
      availableDates.some(
        (candidate) => format(candidate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd"),
      ),
    [availableDates],
  );

  const MANUAL_FIELD_ID: Record<ManualBookingField, string> = {
    patientName: "manualPatientName",
    patientPhone: "manualPatientPhone",
    patientEmail: "manualPatientEmail",
    patientBirthdate: "manualPatientBirthdate",
    reason: "manualReason",
  };
  const fieldClass = (field: ManualBookingField, extra = "") =>
    `w-full rounded-2xl border bg-ink-900/40 px-3 py-2 text-sm text-slate-100 ${extra} ${
      errorFor(field) ? "border-red-400/80 ring-1 ring-red-400/40" : "border-slate-800/80"
    }`;
  const fieldMessage = (field: ManualBookingField) =>
    errorFor(field) ? (
      <p id={`${MANUAL_FIELD_ID[field]}-error`} role="alert" className="text-xs font-medium text-red-300">
        {errorFor(field)}
      </p>
    ) : null;

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
    if (isMultiClinic && !selectedClinic) {
      setError("Please choose a clinic.");
      return;
    }
    // Name, phone and reason are required; first visit, gender, email and birth date are
    // optional but checked when filled in (Rocío, 2026-10-06).
    const problem = firstManualBookingError({
      patientName,
      patientPhone,
      phoneValid,
      patientEmail,
      patientBirthdate,
      reason,
    });
    if (problem) {
      setFieldError(problem);
      document.getElementById(MANUAL_FIELD_ID[problem.field])?.focus();
      return;
    }
    setFieldError(null);
    const reasonTrimmed = reason.slice(0, APPOINTMENT_REASON_MAX_LENGTH).trim();

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
          isNewPatient,
          patientGender: patientGender || null,
          patientBirthdate: patientBirthdate.trim() || null,
          locationId: selectedClinic?.id ?? null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = (data as { message?: string } | null)?.message ?? "";
        if (res.status === 409) {
          // Someone (or this screen a moment ago) took it: hide it and let her pick another;
          // everything she typed stays.
          const takenSlot = selectedSlot;
          setJustBooked((prev) => [
            ...prev,
            {
              id: `taken-${takenSlot.key}`,
              status: "CONFIRMED",
              appointment_datetime: takenSlot.key,
              duration_minutes: slotDuration,
            },
          ]);
          setSelectedSlot(null);
          setError("That time was just booked. Please pick another one.");
          return;
        }
        setError(message || "Could not create manual booking.");
        return;
      }

      const bookedId = String((data as { appointment?: { id?: string } }).appointment?.id ?? "");
      setJustBooked((prev) => [
        ...prev,
        {
          id: bookedId || `booked-${selectedSlot.key}`,
          status: "CONFIRMED",
          appointment_datetime: selectedSlot.key,
          duration_minutes: slotDuration,
        },
      ]);

      setSuccess({
        appointmentId: bookedId,
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

  if (!open) return null;

  return (
    <div
      data-testid="manual-booking-modal-root"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden p-3 sm:p-4"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/70 backdrop-blur-sm"
        aria-label="Close manual booking modal"
      />
      <div
        data-testid="manual-booking-modal-panel"
        className="relative z-10 w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-3xl border border-clinical-100/10 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-xl sm:max-h-[calc(100dvh-2rem)] sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {accessEnded ? (
          <div className="py-6" data-testid="manual-booking-access-ended">
            <h3 className="text-xl font-semibold text-slate-50">You can&apos;t add new bookings</h3>
            <p className="mt-2 text-sm text-slate-300">
              Your DocCy access has ended, so new bookings, online or manual, are switched off. You
              can still answer the requests and handle the visits you already have.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        ) : success ? (
          <div className="py-6">
            <h3
              data-testid="manual-booking-success-title"
              className="text-2xl font-bold tracking-tight text-slate-50"
            >
              Appointment Blocked!
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              {success.patientName} is now booked for {success.dateLabel} at{" "}
              {success.timeLabel} (Cyprus time)
              {selectedClinic ? ` at ${selectedClinic.name}` : ""}.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <a
                href={success.googleCalendarUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-clinical-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/30 transition hover:bg-clinical-300"
              >
                <CalendarPlus className="h-4 w-4" />
                Add to Google
              </a>
              <a
                href={success.iCalUrl}
                className="inline-flex items-center justify-center rounded-2xl border border-clinical-400/40 bg-clinical-400/10 px-4 py-2.5 text-sm font-semibold text-clinical-200 transition hover:border-clinical-400/60 hover:bg-clinical-400/20"
              >
                Add to iCal (.ics)
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
                {MANUAL_BOOKING_LABEL}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {MANUAL_BOOKING_HINT}
              </p>
            </div>

            {isMultiClinic ? (
              <div className="mb-5" data-testid="manual-booking-clinic-picker">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Clinic
                </p>
                <div className="flex flex-wrap gap-2">
                  {clinics.map((clinic, index) => {
                    const selected = clinic.id === selectedClinic?.id;
                    const color = agendaClinicEventColor(index);
                    return (
                      <button
                        key={clinic.id}
                        type="button"
                        onClick={() => {
                          setSelectedClinicId(clinic.id);
                          setSelectedDate(null);
                          setSelectedSlot(null);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          selected
                            ? "border-slate-400 bg-slate-800 text-white"
                            : "border-slate-700 bg-transparent text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <span className={`h-3.5 w-3.5 rounded-[3px] ${color.swatch}`} aria-hidden />
                        {clinic.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800/60 bg-ink-900/30 p-4">
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

              <div className="rounded-2xl border border-slate-800/60 bg-ink-900/30 p-4">
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
                              ? "border-clinical-400/50 bg-clinical-400/10 text-clinical-100"
                              : "border-slate-800/80 bg-slate-900/40 text-slate-200 hover:border-clinical-400/30 hover:bg-clinical-400/5"
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
                <label htmlFor="manualPatientName" className="text-xs font-semibold text-slate-200">
                  Patient Name <span className="text-red-300">*</span>
                </label>
                <input
                  id="manualPatientName"
                  value={patientName}
                  onChange={(e) => {
                    setPatientName(e.target.value);
                    fixed("patientName");
                  }}
                  aria-invalid={errorFor("patientName") ? true : undefined}
                  aria-describedby={errorFor("patientName") ? "manualPatientName-error" : undefined}
                  className={fieldClass("patientName")}
                  placeholder="Patient full name"
                  autoComplete="off"
                />
                {fieldMessage("patientName")}
              </div>
              <div className="space-y-2">
                <label htmlFor="manualPatientPhone" className="text-xs font-semibold text-slate-200">
                  Phone <span className="text-red-300">*</span>
                </label>
                {/* Same phone box and rule as online booking (country code), and only mobile numbers. */}
                <PhoneInput
                  id="manualPatientPhone"
                  tone="dark"
                  value={patientPhone}
                  onChange={(val, isValid) => {
                    setPatientPhone(val);
                    setPhoneValid(isValid && manualPhoneProblem(val) === null);
                    fixed("patientPhone");
                  }}
                  errorMessage={errorFor("patientPhone")}
                />
              </div>
            </div>

            <fieldset className="mt-4 space-y-2">
              <legend className="text-xs font-semibold text-slate-200">
                First visit with you? <span className="font-normal text-slate-400">(optional)</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    [true, "First visit"],
                    [false, "Returning patient"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={label} className={manualChoiceClass(isNewPatient === value)}>
                    <input
                      type="radio"
                      name="manualIsNewPatient"
                      checked={isNewPatient === value}
                      onChange={() => setIsNewPatient(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-slate-200">
                  Gender <span className="font-normal text-slate-400">(optional)</span>
                </legend>
                <div className="grid gap-2">
                  {(
                    [
                      ["female", "Female"],
                      ["male", "Male"],
                      ["prefer_not_to_say", "Prefer not to say"],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className={manualChoiceClass(patientGender === value)}>
                      <input
                        type="radio"
                        name="manualPatientGender"
                        value={value}
                        checked={patientGender === value}
                        onChange={() => setPatientGender(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2">
                <label htmlFor="manualPatientBirthdate" className="text-xs font-semibold text-slate-200">
                  Date of birth <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="manualPatientBirthdate"
                  type="date"
                  min="1900-01-01"
                  max={formatInTimeZone(new Date(), CY_TZ, "yyyy-MM-dd")}
                  value={patientBirthdate}
                  onChange={(e) => {
                    setPatientBirthdate(e.target.value);
                    fixed("patientBirthdate");
                  }}
                  aria-invalid={errorFor("patientBirthdate") ? true : undefined}
                  aria-describedby={errorFor("patientBirthdate") ? "manualPatientBirthdate-error" : undefined}
                  className={fieldClass("patientBirthdate", "[color-scheme:dark]")}
                />
                {fieldMessage("patientBirthdate")}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label htmlFor="manualPatientEmail" className="text-xs font-semibold text-slate-200">
                Email <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="manualPatientEmail"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={patientEmail}
                onChange={(e) => {
                  setPatientEmail(e.target.value);
                  fixed("patientEmail");
                }}
                aria-invalid={errorFor("patientEmail") ? true : undefined}
                aria-describedby={errorFor("patientEmail") ? "manualPatientEmail-error" : undefined}
                className={fieldClass("patientEmail")}
                placeholder="patient@email.com"
              />
              {fieldMessage("patientEmail")}
            </div>

            <div className="mt-4 space-y-2">
              <label htmlFor="manualReason" className="text-xs font-semibold text-slate-200">
                Reason for visit <span className="text-red-300">*</span>
              </label>
              <textarea
                id="manualReason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value.slice(0, APPOINTMENT_REASON_MAX_LENGTH));
                  fixed("reason");
                }}
                rows={3}
                aria-invalid={errorFor("reason") ? true : undefined}
                aria-describedby={errorFor("reason") ? "manualReason-error" : undefined}
                className={fieldClass("reason", "resize-y")}
                placeholder="Brief reason for this visit"
              />
              {fieldMessage("reason")}
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
                className="inline-flex items-center gap-2 rounded-2xl bg-clinical-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/30 transition hover:bg-clinical-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
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


/** A radio choice styled as a chip, like the rest of the manual booking modal. */
function manualChoiceClass(selected: boolean): string {
  return `flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition ${
    selected
      ? "border-clinical-400/70 bg-clinical-400/10 text-clinical-100"
      : "border-slate-800/80 bg-ink-900/40 text-slate-200 hover:border-slate-600"
  }`;
}
