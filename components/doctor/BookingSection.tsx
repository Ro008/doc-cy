"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  addDays,
  addHours,
  addMinutes,
  format,
} from "date-fns";
import { formatInTimeZone, utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { el as elLocale, enGB } from "date-fns/locale";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { CY_TZ } from "@/lib/appointments";
import {
  bookingSlotDateFromKey,
  hrefWithoutBookingSlotQuery,
  parseBookingSlotParam,
} from "@/lib/booking-slot-param";
import { normalizeMinimumNoticeHours } from "@/lib/doctor-settings";
import { APPOINTMENT_REASON_MAX_LENGTH } from "@/lib/visit-types";
import { type PatientGender } from "@/lib/booking-patient-fields";
import { BOOKING_SLOT_REFRESH_MS, bookingRefusal, hideRefusedSlot } from "@/lib/booking-refusal";
import {
  firstBookingFormError,
  type BookingFormError,
  type BookingFormField,
} from "@/lib/booking-form-validation";
import { formatDateDDMMYYYY } from "@/lib/date-format";
import "react-day-picker/dist/style.css";
import { useLocale, useTranslations } from "next-intl";

type WeeklySlot = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  duration: number;
};

type BookingSectionProps = {
  doctorId: string;
  doctorName: string;
  weeklySlots: WeeklySlot[];
  takenSlotTimes?: string[];
  profileSlug?: string;
  /** Cyprus wall-clock slot from finder deep-link (`YYYY-MM-DDTHH:mm`). */
  initialSlotKey?: string | null;
  breakStart?: string;
  breakEnd?: string;
  onlineBookingsPaused?: boolean;
  /** The profile shows a Call button, so a paused calendar can point the patient at it. */
  publicPhoneAvailable?: boolean;
  holidayModeEnabled?: boolean;
  holidayStartDate?: string | null;
  holidayEndDate?: string | null;
  bookingHorizonDays?: number;
  minimumNoticeHours?: number;
  locationId?: string | null;
  locationLabel?: string | null;
  locationScopedPause?: boolean;
};

type SlotOption = {
  key: string;
  date: Date;
  dateKey: string;
  labelTime: string;
  labelFull: string;
  slotKey: string;
};

export function BookingSection({
  doctorId,
  doctorName,
  weeklySlots,
  takenSlotTimes = [],
  initialSlotKey = null,
  breakStart,
  breakEnd,
  onlineBookingsPaused = false,
  publicPhoneAvailable = false,
  holidayModeEnabled = false,
  holidayStartDate = null,
  holidayEndDate = null,
  bookingHorizonDays = 90,
  minimumNoticeHours = 2,
  locationId = null,
  locationLabel = null,
  locationScopedPause = false,
}: BookingSectionProps) {
  const normalizedBookingHorizonDays = [14, 30, 90, 180].includes(
    bookingHorizonDays
  )
    ? bookingHorizonDays
    : 90;
  const normalizedMinimumNoticeHours =
    normalizeMinimumNoticeHours(minimumNoticeHours);

  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("BookingPage");
  const activeLocale = useLocale();
  const dateFnsLocale = activeLocale === "el" ? elLocale : enGB;
  /** Times the server refused while this page was open (just booked by someone else). */
  const [refusedSlotKeys, setRefusedSlotKeys] = React.useState<string[]>([]);
  const takenSet = React.useMemo(
    () => new Set([...takenSlotTimes, ...refusedSlotKeys]),
    [takenSlotTimes, refusedSlotKeys]
  );
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<SlotOption | null>(
    null
  );
  const [showContactForm, setShowContactForm] = React.useState(false);
  const [patientName, setPatientName] = React.useState("");
  const [patientEmail, setPatientEmail] = React.useState("");
  const [patientPhone, setPatientPhone] = React.useState("");
  const [phoneValid, setPhoneValid] = React.useState(true);
  const [showPhoneError, setShowPhoneError] = React.useState(false);
  const [isNewPatient, setIsNewPatient] = React.useState<boolean | null>(null);
  const [visitReason, setVisitReason] = React.useState("");
  const [patientGender, setPatientGender] = React.useState<PatientGender | "">("");
  const [patientBirthdate, setPatientBirthdate] = React.useState("");
  /** Set once the request is saved: the patient confirms it from the email (user, 2026-10-02). */
  const [checkEmailAddress, setCheckEmailAddress] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** The first field the patient still has to fix; its message shows under that field. */
  const [fieldError, setFieldError] = React.useState<BookingFormError | null>(null);
  const [bookingSuccess, setBookingSuccess] = React.useState(false);
  const [lastAppointmentId, setLastAppointmentId] = React.useState<string | null>(
    null
  );
  const appliedInitialSlotRef = React.useRef(false);
  const successRef = React.useRef<HTMLDivElement | null>(null);

  // The success card replaces the taller form, so it can land above or below the fold:
  // glide its top into view so nobody has to scroll to read "Check your email".
  React.useEffect(() => {
    if (!bookingSuccess) return;
    const el = successRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= window.innerHeight) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [bookingSuccess]);

  const holidayActive =
    Boolean(holidayModeEnabled) &&
    Boolean(holidayStartDate) &&
    Boolean(holidayEndDate);

  // Recompute the offered times every minute: a time that slips inside the minimum notice
  // while the page is open disappears instead of being refused on send.
  const [clockTick, setClockTick] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setClockTick((n) => n + 1), BOOKING_SLOT_REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  // Build all slots for the next CALENDAR_DAYS_AHEAD days
  const upcomingSlots: SlotOption[] = React.useMemo(() => {
    const result: SlotOption[] = [];
    const nowUtc = new Date();
    const nowCyprus = utcToZonedTime(nowUtc, CY_TZ);
    const todayCyprusKey = format(nowCyprus, "yyyy-MM-dd");
    const nowCyprusTime = format(nowCyprus, "HH:mm");
    const minimumNoticeCutoffUtc = addHours(nowUtc, normalizedMinimumNoticeHours);

    for (let offset = 0; offset <= normalizedBookingHorizonDays; offset++) {
      const cyprusDay = addDays(nowCyprus, offset);
      const dayCyprusKey = format(cyprusDay, "yyyy-MM-dd");
      const dayOfWeek = cyprusDay.getDay();

      // Block whole day at Cyprus midnight boundaries when holiday mode is active.
      if (
        holidayActive &&
        holidayStartDate &&
        holidayEndDate &&
        dayCyprusKey >= holidayStartDate &&
        dayCyprusKey <= holidayEndDate
      ) {
        continue;
      }

      const daySlots = weeklySlots.filter((s) => s.day_of_week === dayOfWeek);

      for (const s of daySlots) {
        const [startHour, startMinute] = s.start_time.split(":").map(Number);
        const [endHour, endMinute] = s.end_time.split(":").map(Number);
        let cursorMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        while (cursorMinutes < endMinutes) {
          const slotHour = Math.floor(cursorMinutes / 60)
            .toString()
            .padStart(2, "0");
          const slotMinute = (cursorMinutes % 60).toString().padStart(2, "0");
          const timeLabel = `${slotHour}:${slotMinute}`;

          // Skip past times only for current Cyprus day.
          if (dayCyprusKey === todayCyprusKey && timeLabel < nowCyprusTime) {
            cursorMinutes += s.duration;
            continue;
          }

          // Skip slots that fall inside the doctor's daily break window
          if (
            breakStart &&
            breakEnd &&
            timeLabel >= breakStart &&
            timeLabel < breakEnd
          ) {
            cursorMinutes += s.duration;
            continue;
          }

          const slotLocal = `${dayCyprusKey}T${timeLabel}:00`;
          const slotUtcDate = zonedTimeToUtc(slotLocal, CY_TZ);
          // Hide slots that violate the minimum notice period.
          if (slotUtcDate.getTime() < minimumNoticeCutoffUtc.getTime()) {
            cursorMinutes += s.duration;
            continue;
          }
          const cyprusSlotDate = utcToZonedTime(slotUtcDate, CY_TZ);
          const slotKey = `${dayCyprusKey}T${timeLabel}`;
          result.push({
            key: slotUtcDate.toISOString(),
            date: slotUtcDate,
            dateKey: dayCyprusKey,
            labelTime: timeLabel,
            labelFull: format(cyprusSlotDate, "EEE d MMM, HH:mm", {
              locale: dateFnsLocale,
            }),
            slotKey,
          });

          cursorMinutes += s.duration;
        }
      }
    }
    return result;
  }, [
    weeklySlots,
    breakStart,
    breakEnd,
    holidayActive,
    holidayStartDate,
    holidayEndDate,
    normalizedBookingHorizonDays,
    normalizedMinimumNoticeHours,
    clockTick,
  ]);

  // The chosen time stopped being offered (too soon now): back to the calendar, and say why.
  // The patient's details stay filled in.
  React.useEffect(() => {
    if (!selectedSlot || bookingSuccess || submitting) return;
    if (upcomingSlots.some((slot) => slot.slotKey === selectedSlot.slotKey)) return;
    setSelectedSlot(null);
    setShowContactForm(false);
    setError(t("errors.slotTooSoon"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingSlots]);

  const isSlotTaken = (slot: SlotOption) => takenSet.has(slot.slotKey);

  React.useEffect(() => {
    if (appliedInitialSlotRef.current) return;
    if (onlineBookingsPaused) return;

    const slotKey = parseBookingSlotParam(initialSlotKey);
    if (!slotKey) return;

    // Wait until we know whether this doctor has any bookable slots.
    if (!weeklySlots || weeklySlots.length === 0) return;
    appliedInitialSlotRef.current = true;

    const clearSlotQuery = () => {
      if (typeof window === "undefined") return;
      const next = hrefWithoutBookingSlotQuery(pathname, window.location.search);
      if (!next) return;
      router.replace(next, { scroll: false });
    };

    const match = upcomingSlots.find((slot) => slot.slotKey === slotKey);
    const date = bookingSlotDateFromKey(slotKey);

    if (match && !takenSet.has(match.slotKey)) {
      setSelectedDate(date ?? match.date);
      setSelectedSlot(match);
      setShowContactForm(true);
      setError(null);
      clearSlotQuery();
      return;
    }

    if (date) setSelectedDate(date);
    setSelectedSlot(null);
    setShowContactForm(false);
    setError(t("errors.preselectedSlotUnavailable"));
    clearSlotQuery();
  }, [
    initialSlotKey,
    onlineBookingsPaused,
    weeklySlots,
    upcomingSlots,
    takenSet,
    pathname,
    router,
    t,
  ]);

  // Dates that have at least one available (non-taken) slot
  const availableDates = React.useMemo(() => {
    const dateSet = new Set<string>();
    upcomingSlots.forEach((slot) => {
      if (!isSlotTaken(slot)) {
        dateSet.add(slot.dateKey);
      }
    });
    return Array.from(dateSet).map((d) => {
      const [y, m, day] = d.split("-").map(Number);
      return new Date(y, m - 1, day);
    });
  }, [upcomingSlots, takenSet]);

  // Slots for the currently selected date (only available ones)
  const slotsForSelectedDay = React.useMemo(() => {
    if (!selectedDate) return [];
    const dayKey = format(selectedDate, "yyyy-MM-dd");
    return upcomingSlots.filter(
      (slot) => slot.dateKey === dayKey && !isSlotTaken(slot)
    );
  }, [selectedDate, upcomingSlots, takenSet]);

  /** Field id to focus for each form field (radio groups: their first option). */
  const FIELD_FOCUS_ID: Record<BookingFormField, string> = {
    patientName: "name",
    patientEmail: "email",
    patientPhone: "phone",
    isNewPatient: "visitHistory-first",
    patientGender: "patientGender-female",
    patientBirthdate: "patientBirthdate",
    visitReason: "visitReason",
  };

  /** Bumped on each refused submit so the effect below runs even for the same field twice. */
  const [focusRequest, setFocusRequest] = React.useState<{ field: BookingFormField; n: number } | null>(null);
  function focusField(field: BookingFormField) {
    setFocusRequest((prev) => ({ field, n: (prev?.n ?? 0) + 1 }));
  }
  // After the message is on screen: glide to the field and put the cursor in it.
  React.useEffect(() => {
    if (!focusRequest) return;
    const box = document.getElementById(`field-${focusRequest.field}`);
    const input = document.getElementById(FIELD_FOCUS_ID[focusRequest.field]) as HTMLElement | null;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    input?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  /** Clears the field's message as soon as the patient changes that field. */
  function fixed(field: BookingFormField) {
    setFieldError((current) => (current?.field === field ? null : current));
  }

  const errorFor = (field: BookingFormField) =>
    fieldError?.field === field ? t(`errors.${fieldError.messageKey}`) : null;

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!selectedSlot) {
        setError(t("errors.selectTimeSlot"));
        return;
      }
      // Say exactly what is missing, under that field, and take the patient there.
      const problem = firstBookingFormError({
        patientName,
        patientEmail,
        patientPhone,
        phoneValid,
        isNewPatient,
        patientGender,
        patientBirthdate,
        visitReason,
      });
      if (problem) {
        setFieldError(problem);
        focusField(problem.field);
        return;
      }
      setFieldError(null);
      const reasonTrim = visitReason.slice(0, APPOINTMENT_REASON_MAX_LENGTH).trim();
      let didNavigateToSuccess = false;
      try {
        setSubmitting(true);
        const res = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doctorId,
            patientName,
            patientEmail,
            patientPhone,
            appointmentLocal: selectedSlot.slotKey,
            reason: reasonTrim,
            isNewPatient,
            patientGender,
            patientBirthdate,
            ...(locationId ? { locationId } : {}),
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          // Plain words instead of the server's technical message; a time that is no longer
          // offered sends the patient back to the calendar (details stay filled in).
          const refusal = bookingRefusal(res.status, data?.code);
          if (refusal) {
            setError(t(`errors.${refusal.messageKey}`, { doctorName }));
            if (refusal.backToCalendar) {
              const refusedKey = selectedSlot.slotKey;
              setRefusedSlotKeys((hidden) => hideRefusedSlot(hidden, refusedKey, refusal));
              // Reload the booked times too: whatever else was taken meanwhile drops out as well.
              router.refresh();
              setSelectedSlot(null);
              setShowContactForm(false);
            }
            return;
          }
          setError(
            data?.message ||
              t("errors.bookingFailed")
          );
          return;
        }
        // 202: the request waits for the patient to confirm the emailed link.
        if (res.status === 202) {
          setCheckEmailAddress(patientEmail.trim());
        }
        setLastAppointmentId(null);
        setBookingSuccess(true);
        setSelectedSlot(null);
        setSelectedDate(null);
        setShowContactForm(false);
        setPatientName("");
        setPatientEmail("");
        setPatientPhone("");
        setIsNewPatient(null);
        setVisitReason("");
        setPatientGender("");
        setPatientBirthdate("");
        setShowPhoneError(false);
      } catch (err) {
        console.error(err);
        setError(t("errors.somethingWentWrong"));
      } finally {
        // If we already navigated to the request-sent page, keep the button in the
        // loading state until unmount (prevents a "stopped loading" flicker).
        if (!didNavigateToSuccess) {
          setSubmitting(false);
        }
      }
    },
    [
      selectedSlot,
      patientName,
      patientEmail,
      patientPhone,
      phoneValid,
      isNewPatient,
      visitReason,
      patientGender,
      patientBirthdate,
      doctorId,
      doctorName,
      locationId,
      t,
    ]
  );

  if (onlineBookingsPaused) {
    return (
      <div className="rounded-3xl border border-clinical-200 bg-white p-6 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(18,184,192,0.06)] backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-ink-900">
          {t("bookingsTemporarilyUnavailable")}
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          {locationScopedPause
            ? t("appointmentsPausedAtLocation")
            : t("appointmentsPaused")}
        </p>
        {publicPhoneAvailable ? (
          <p className="mt-2 text-sm font-medium text-ink-700">
            {t("appointmentsPausedCallHint")}
          </p>
        ) : null}
      </div>
    );
  }

  if (!weeklySlots || weeklySlots.length === 0) {
    return (
      <div className="rounded-3xl border border-clinical-200 bg-white p-6 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(18,184,192,0.06)] backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-ink-900">
          {t("title")}
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          {t("availabilityNotPublished", {doctorName})}
        </p>
      </div>
    );
  }

  if (upcomingSlots.length === 0) {
    return (
      <div className="rounded-3xl border border-clinical-200 bg-white p-6 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(18,184,192,0.06)] backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-ink-900">
          {t("bookingsTemporarilyUnavailable")}
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          {holidayActive && holidayStartDate && holidayEndDate
            ? t("calendarBlockedFromTo", {
                start: formatDateDDMMYYYY(holidayStartDate),
                end: formatDateDDMMYYYY(holidayEndDate),
              })
            : t("noAvailableTimesRightNow")}
        </p>
      </div>
    );
  }

  /** Back to a clean calendar where the success card was (the form fields were cleared on send). */
  function startOver() {
    const el = successRef.current;
    const top = el ? el.getBoundingClientRect().top + window.scrollY - 96 : null;
    setBookingSuccess(false);
    setCheckEmailAddress(null);
    setLastAppointmentId(null);
    setError(null);
    setSubmitting(false);
    if (top !== null) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.requestAnimationFrame(() => {
        if (top < window.scrollY) window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
      });
    }
  }

  if (bookingSuccess) {
    return (
      <div
        ref={successRef}
        data-testid="booking-success-message"
        data-appointment-id={lastAppointmentId ?? ""}
        className="scroll-mt-24 rounded-3xl border border-amber-200 bg-amber-50 p-8 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(245,158,11,0.12)] sm:p-10"
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute inset-0 scale-150 rounded-full bg-amber-400/20 blur-2xl" />
            <Clock
              className="relative h-20 w-20 text-amber-400 sm:h-24 sm:w-24"
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            {checkEmailAddress ? t("checkEmailTitle") : t("requestSubmittedTitle")}
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-600">
            {checkEmailAddress
              ? t("checkEmailMessage", { email: checkEmailAddress, doctorName })
              : t("requestSubmittedMessage", { doctorName })}
          </p>
          {checkEmailAddress ? (
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-ink-500">{t("checkEmailHint")}</p>
          ) : null}
          {/* Done shows the calendar again in place: a link to this same profile URL did nothing. */}
          <button
            type="button"
            onClick={startOver}
            data-testid="booking-success-done"
            className="mt-8 w-full max-w-xs rounded-2xl border border-amber-300 bg-white px-6 py-3 text-sm font-semibold text-amber-900 shadow-sm transition hover:border-amber-400 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-2 focus:ring-offset-white"
          >
            {t("doneButton")}
          </button>
        </div>
      </div>
    );
  }

  // Contact form step (after Confirm on time slot)
  if (showContactForm && selectedSlot) {
    return (
      <div className="rounded-3xl border border-clinical-200 bg-white p-6 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(18,184,192,0.06)] backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">
              {t("yourDetails")}
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              {selectedSlot.labelFull} · {t("cyprusTime")}
              {locationLabel ? ` · ${locationLabel}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowContactForm(false);
              setError(null);
            }}
            className="text-xs font-medium text-ink-500 transition hover:text-clinical-700"
          >
            {t("changeTime")}
          </button>
        </div>
        {/* noValidate: our own messages under each field, not the browser's generic bubble. */}
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <div id="field-patientName" className="scroll-mt-24 space-y-2">
            <label
              htmlFor="name"
              className="text-xs font-semibold text-ink-800"
            >
              {t("patientFullNameLabel")}
            </label>
            <input
              id="name"
              type="text"
              required
              value={patientName}
              onChange={(e) => {
                setPatientName(e.target.value);
                fixed("patientName");
              }}
              aria-invalid={errorFor("patientName") ? true : undefined}
              aria-describedby={errorFor("patientName") ? "name-error" : undefined}
              className={`w-full rounded-2xl border bg-white px-3 py-2 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-clinical-400/60 ${errorFor("patientName") ? "border-red-400 ring-1 ring-red-300" : "border-ink-200"}`}
              placeholder={t("patientFullNamePlaceholder")}
            />
            {errorFor("patientName") ? (
              <p id="name-error" role="alert" className="text-xs font-medium text-red-600">
                {errorFor("patientName")}
              </p>
            ) : null}
          </div>
          <div id="field-patientEmail" className="scroll-mt-24 space-y-2">
            <label
              htmlFor="email"
              className="text-xs font-semibold text-ink-800"
            >
              {t("emailLabel")}
            </label>
            <input
              id="email"
              type="email"
              required
              value={patientEmail}
              onChange={(e) => {
                setPatientEmail(e.target.value);
                fixed("patientEmail");
              }}
              aria-invalid={errorFor("patientEmail") ? true : undefined}
              aria-describedby={errorFor("patientEmail") ? "email-error" : undefined}
              className={`w-full rounded-2xl border bg-white px-3 py-2 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-clinical-400/60 ${errorFor("patientEmail") ? "border-red-400 ring-1 ring-red-300" : "border-ink-200"}`}
              placeholder={t("emailPlaceholder")}
            />
            {errorFor("patientEmail") ? (
              <p id="email-error" role="alert" className="text-xs font-medium text-red-600">
                {errorFor("patientEmail")}
              </p>
            ) : null}
          </div>
          <div id="field-patientPhone" className="scroll-mt-24 space-y-2">
            <PhoneInput
              id="phone"
              label={t("phonePriorityContactLabel")}
              value={patientPhone}
              onChange={(val, isValid) => {
                setPatientPhone(val);
                setPhoneValid(isValid);
                setShowPhoneError(false);
                fixed("patientPhone");
              }}
              showValidationError={showPhoneError}
              errorMessage={errorFor("patientPhone")}
            />
          </div>
          <fieldset
            id="field-isNewPatient"
            className="scroll-mt-24 space-y-2"
            aria-invalid={errorFor("isNewPatient") ? true : undefined}
            aria-describedby={errorFor("isNewPatient") ? "visitHistory-error" : undefined}
          >
            <legend className="text-xs font-semibold text-ink-800">
              {t("visitHistoryLabel", { doctorName })}{" "}
              <span className="text-red-600">*</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm transition ${
                  isNewPatient === true
                    ? "border-clinical-500 bg-clinical-50 text-clinical-900"
                    : errorFor("isNewPatient")
                      ? "border-red-400 bg-white text-ink-800"
                      : "border-ink-200 bg-white text-ink-800 hover:border-clinical-300"
                }`}
              >
                <input
                  id="visitHistory-first"
                  type="radio"
                  name="visitHistory"
                  className="h-4 w-4 border-ink-300 text-clinical-600 focus:ring-clinical-400/60"
                  checked={isNewPatient === true}
                  onChange={() => {
                    setIsNewPatient(true);
                    fixed("isNewPatient");
                  }}
                />
                {t("visitHistoryFirstTime")}
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm transition ${
                  isNewPatient === false
                    ? "border-clinical-500 bg-clinical-50 text-clinical-900"
                    : errorFor("isNewPatient")
                      ? "border-red-400 bg-white text-ink-800"
                      : "border-ink-200 bg-white text-ink-800 hover:border-clinical-300"
                }`}
              >
                <input
                  type="radio"
                  name="visitHistory"
                  className="h-4 w-4 border-ink-300 text-clinical-600 focus:ring-clinical-400/60"
                  checked={isNewPatient === false}
                  onChange={() => {
                    setIsNewPatient(false);
                    fixed("isNewPatient");
                  }}
                />
                {t("visitHistoryReturning")}
              </label>
            </div>
            {errorFor("isNewPatient") ? (
              <p id="visitHistory-error" role="alert" className="text-xs font-medium text-red-600">
                {errorFor("isNewPatient")}
              </p>
            ) : null}
          </fieldset>
          <fieldset
            id="field-patientGender"
            className="scroll-mt-24 space-y-2"
            aria-invalid={errorFor("patientGender") ? true : undefined}
            aria-describedby={errorFor("patientGender") ? "patientGender-error" : undefined}
          >
            <legend className="text-xs font-semibold text-ink-800">
              {t("genderLabel")} <span className="text-red-600">*</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["female", t("genderFemale")],
                  ["male", t("genderMale")],
                  ["prefer_not_to_say", t("genderPreferNotToSay")],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm transition ${
                    patientGender === value
                      ? "border-clinical-500 bg-clinical-50 text-clinical-900"
                      : errorFor("patientGender")
                        ? "border-red-400 bg-white text-ink-800"
                        : "border-ink-200 bg-white text-ink-800 hover:border-clinical-300"
                  }`}
                >
                  <input
                    id={`patientGender-${value}`}
                    type="radio"
                    name="patientGender"
                    value={value}
                    className="h-4 w-4 border-ink-300 text-clinical-600 focus:ring-clinical-400/60"
                    checked={patientGender === value}
                    onChange={() => {
                      setPatientGender(value);
                      fixed("patientGender");
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            {errorFor("patientGender") ? (
              <p id="patientGender-error" role="alert" className="text-xs font-medium text-red-600">
                {errorFor("patientGender")}
              </p>
            ) : null}
          </fieldset>
          <div id="field-patientBirthdate" className="scroll-mt-24 space-y-2">
            <label htmlFor="patientBirthdate" className="text-xs font-semibold text-ink-800">
              {t("birthdateLabel")} <span className="text-red-600">*</span>
            </label>
            <input
              id="patientBirthdate"
              type="date"
              required
              min="1900-01-01"
              max={formatInTimeZone(new Date(), CY_TZ, "yyyy-MM-dd")}
              value={patientBirthdate}
              onChange={(e) => {
                setPatientBirthdate(e.target.value);
                fixed("patientBirthdate");
              }}
              aria-invalid={errorFor("patientBirthdate") ? true : undefined}
              aria-describedby={errorFor("patientBirthdate") ? "patientBirthdate-error" : undefined}
              className={`w-full rounded-2xl border bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-clinical-400/60 ${errorFor("patientBirthdate") ? "border-red-400 ring-1 ring-red-300" : "border-ink-200"}`}
            />
            {errorFor("patientBirthdate") ? (
              <p id="patientBirthdate-error" role="alert" className="text-xs font-medium text-red-600">
                {errorFor("patientBirthdate")}
              </p>
            ) : null}
            <p className="text-[11px] leading-relaxed text-ink-500">
              {t("personalDetailsPrivacyNote", { doctorName })}
            </p>
          </div>
          <div id="field-visitReason" className="scroll-mt-24 space-y-2">
            <label
              htmlFor="visitReason"
              className="text-xs font-semibold text-ink-800"
            >
              {t("visitReasonLabel")}{" "}
              <span className="text-red-600">*</span>
            </label>
            <textarea
              id="visitReason"
              required
              rows={4}
              maxLength={APPOINTMENT_REASON_MAX_LENGTH}
              value={visitReason}
              onChange={(e) => {
                setVisitReason(e.target.value.slice(0, APPOINTMENT_REASON_MAX_LENGTH));
                fixed("visitReason");
              }}
              aria-invalid={errorFor("visitReason") ? true : undefined}
              aria-describedby={errorFor("visitReason") ? "visitReason-error" : undefined}
              placeholder={t("visitReasonPlaceholder")}
              className={`w-full resize-y rounded-2xl border bg-white px-3 py-2 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-clinical-400/60 ${errorFor("visitReason") ? "border-red-400 ring-1 ring-red-300" : "border-ink-200"}`}
            />
            {errorFor("visitReason") ? (
              <p id="visitReason-error" role="alert" className="text-xs font-medium text-red-600">
                {errorFor("visitReason")}
              </p>
            ) : null}
            <p className="text-right text-[11px] text-ink-500">
              {visitReason.length}/{APPOINTMENT_REASON_MAX_LENGTH}
            </p>
          </div>
          {error && (
            <div
              data-testid="booking-error-message"
              className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-clinical-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-clinical-500/20 transition hover:bg-clinical-400 disabled:cursor-not-allowed disabled:bg-ink-300 disabled:text-ink-500"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span>{t("sendingRequest")}</span>
              </>
            ) : (
              <span>{t("sendRequestButton")}</span>
            )}
          </button>
        </form>
      </div>
    );
  }

  // Two-column: calendar + time slots
  const isDateAvailable = (date: Date) =>
    availableDates.some(
      (d) => format(d, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    );

  return (
    <div className="rounded-3xl border border-clinical-200 bg-white shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(18,184,192,0.06)] backdrop-blur-xl">
      <div className="border-b border-ink-200 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">
                {t("title")}
            </h2>
            {locationLabel ? (
              <>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-clinical-700">
                  {t("pickTimeStep")}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink-800">
                  {t("timesOnlyForClinic", { clinic: locationLabel })}
                </p>
              </>
            ) : null}
            <p className="mt-1 text-xs text-ink-500">
              {t("allTimesInCyprusHint")}
            </p>
          </div>
          <span className="rounded-full bg-clinical-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-clinical-700">
            {t("requestBadge")}
          </span>
        </div>
        {error ? (
          <div
            data-testid="booking-error-message"
            className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 p-4 sm:grid-cols-2 sm:p-6">
        {/* Left: calendar */}
        <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
            {t("selectDate")}
          </p>
          <DayPicker
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={(d) => {
              setSelectedDate(d ?? null);
              setSelectedSlot(null);
              setError(null);
            }}
            fromDate={new Date()}
            toDate={addDays(new Date(), normalizedBookingHorizonDays)}
            disabled={(date) => !isDateAvailable(date)}
            locale={dateFnsLocale}
            captionLayout="buttons"
            className="rdp-light"
            classNames={{
              root: "p-0",
              caption: "flex justify-between items-center mb-4",
              caption_label: "text-sm font-semibold text-ink-800",
              nav: "flex gap-1",
              nav_button_previous: "rounded-lg border border-ink-200 bg-white p-2 text-ink-600 hover:border-clinical-300 hover:bg-clinical-50",
              nav_button_next: "rounded-lg border border-ink-200 bg-white p-2 text-ink-600 hover:border-clinical-300 hover:bg-clinical-50",
              month: "w-full",
              day: "p-0.5 w-9 h-9 rounded-full text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-clinical-400/60 focus:ring-offset-2 focus:ring-offset-white",
            }}
            modifiers={{
              available: availableDates,
            }}
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

        {/* Right: time slots (only when date selected) */}
        <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
          {!selectedDate ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-ink-500">
                {t("selectDateOnCalendar")}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {t("availableTimesHere")}
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                {format(selectedDate, "EEEE, d MMMM", { locale: dateFnsLocale })}
              </p>
              {slotsForSelectedDay.length === 0 ? (
                <p className="py-6 text-sm text-ink-500">
                  {t("noAvailableTimesThisDay")}
                </p>
              ) : (
                <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                  {slotsForSelectedDay.map((slot) => {
                    const isSelected = selectedSlot?.key === slot.key;
                    return (
                      <div
                        key={slot.key}
                        className={`rounded-2xl border transition-all duration-200 ${
                          isSelected
                            ? "border-clinical-400 bg-clinical-50 shadow-sm"
                            : "border-ink-200 bg-white hover:border-clinical-300 hover:bg-clinical-50/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 p-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSlot(isSelected ? null : slot);
                              setError(null);
                            }}
                            className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-ink-800"
                          >
                            <span
                              className="font-mono text-ink-600"
                              style={{ minWidth: "3rem" }}
                            >
                              {slot.labelTime}
                            </span>
                            <span>
                              {isSelected ? t("timeSlotSelected") : t("timeSlotSelect")}
                            </span>
                          </button>
                          {isSelected && (
                            <button
                              type="button"
                              onClick={() => setShowContactForm(true)}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-clinical-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-clinical-400 focus:outline-none focus:ring-2 focus:ring-clinical-400/50 disabled:opacity-70"
                            >
                              Confirm
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
