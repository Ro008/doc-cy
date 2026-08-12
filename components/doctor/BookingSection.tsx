"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addHours,
  addMinutes,
  format,
} from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { el as elLocale, enGB } from "date-fns/locale";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { CY_TZ } from "@/lib/appointments";
import { normalizeMinimumNoticeHours } from "@/lib/doctor-settings";
import { APPOINTMENT_REASON_MAX_LENGTH } from "@/lib/visit-types";
import { formatDateDDMMYYYY } from "@/lib/date-format";
import "react-day-picker/dist/style.css";
import { useLocale, useTranslations } from "next-intl";
import { PendingLink } from "@/components/navigation/PendingLink";

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
  breakStart?: string;
  breakEnd?: string;
  onlineBookingsPaused?: boolean;
  holidayModeEnabled?: boolean;
  holidayStartDate?: string | null;
  holidayEndDate?: string | null;
  bookingHorizonDays?: number;
  minimumNoticeHours?: number;
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
  profileSlug,
  breakStart,
  breakEnd,
  onlineBookingsPaused = false,
  holidayModeEnabled = false,
  holidayStartDate = null,
  holidayEndDate = null,
  bookingHorizonDays = 90,
  minimumNoticeHours = 2,
}: BookingSectionProps) {
  const normalizedBookingHorizonDays = [14, 30, 90, 180].includes(
    bookingHorizonDays
  )
    ? bookingHorizonDays
    : 90;
  const normalizedMinimumNoticeHours =
    normalizeMinimumNoticeHours(minimumNoticeHours);

  const router = useRouter();
  const t = useTranslations("BookingPage");
  const activeLocale = useLocale();
  const dateFnsLocale = activeLocale === "el" ? elLocale : enGB;
  const takenSet = React.useMemo(
    () => new Set(takenSlotTimes),
    [takenSlotTimes]
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
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = React.useState(false);
  const [lastAppointmentId, setLastAppointmentId] = React.useState<string | null>(
    null
  );

  const holidayActive =
    Boolean(holidayModeEnabled) &&
    Boolean(holidayStartDate) &&
    Boolean(holidayEndDate);

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
  ]);

  const isSlotTaken = (slot: SlotOption) => takenSet.has(slot.slotKey);

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

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!selectedSlot) {
        setError(t("errors.selectTimeSlot"));
        return;
      }
      if (!patientName || !patientEmail || !patientPhone) {
        setError(t("errors.completePatientDetails"));
        return;
      }
      if (!phoneValid) {
        setShowPhoneError(true);
        setError(t("errors.validPhone"));
        return;
      }
      if (isNewPatient === null) {
        setError(t("errors.selectVisitHistory"));
        return;
      }
      const reasonTrim = visitReason.slice(0, APPOINTMENT_REASON_MAX_LENGTH).trim();
      if (!reasonTrim) {
        setError(t("errors.reasonRequired"));
        return;
      }
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
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (res.status === 409) {
            setError(
              t("errors.timeSlotJustBooked")
            );
            return;
          }
          setError(
            data?.message ||
              t("errors.bookingFailed")
          );
          return;
        }
        const newId =
          (data?.appointment?.id as string | undefined) ?? null;
        setLastAppointmentId(newId);
        if (profileSlug && newId) {
          didNavigateToSuccess = true;
          router.push(
            `/${activeLocale}/${profileSlug}/request-sent?appointmentId=${encodeURIComponent(
              newId
            )}`
          );
          return;
        }
        setBookingSuccess(true);
        setSelectedSlot(null);
        setSelectedDate(null);
        setShowContactForm(false);
        setPatientName("");
        setPatientEmail("");
        setPatientPhone("");
        setIsNewPatient(null);
        setVisitReason("");
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
      doctorId,
      profileSlug,
      router,
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
          {t("appointmentsPaused")}
        </p>
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

  if (bookingSuccess) {
    return (
      <div
        data-testid="booking-success-message"
        data-appointment-id={lastAppointmentId ?? ""}
        className="rounded-3xl border border-amber-200 bg-amber-50 p-8 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(245,158,11,0.12)] sm:p-10"
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
            {t("requestSubmittedTitle")}
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-600">
            {t("requestSubmittedMessage", { doctorName })}
          </p>
          {profileSlug ? (
            <PendingLink
              href={`/${activeLocale}/${profileSlug}`}
              className="mt-8 flex w-full max-w-xs items-center justify-center rounded-2xl border border-amber-300 bg-white px-6 py-3 text-sm font-semibold text-amber-900 shadow-sm transition hover:border-amber-400 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-2 focus:ring-offset-white"
            >
              {t("doneButton")}
            </PendingLink>
          ) : (
            <button
              type="button"
              onClick={() => setBookingSuccess(false)}
              className="mt-8 w-full max-w-xs rounded-2xl border border-amber-300 bg-white px-6 py-3 text-sm font-semibold text-amber-900 shadow-sm transition hover:border-amber-400 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-2 focus:ring-offset-white"
            >
              {t("doneButton")}
            </button>
          )}
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
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
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
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
              placeholder={t("patientFullNamePlaceholder")}
            />
          </div>
          <div className="space-y-2">
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
              onChange={(e) => setPatientEmail(e.target.value)}
              className="w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
              placeholder={t("emailPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <PhoneInput
              id="phone"
              label={t("phonePriorityContactLabel")}
              value={patientPhone}
              onChange={(val, isValid) => {
                setPatientPhone(val);
                setPhoneValid(isValid);
                setShowPhoneError(false);
              }}
              showValidationError={showPhoneError}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-ink-800">
              {t("visitHistoryLabel", { doctorName })}{" "}
              <span className="text-red-600">*</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm transition ${
                  isNewPatient === true
                    ? "border-clinical-500 bg-clinical-50 text-clinical-900"
                    : "border-ink-200 bg-white text-ink-800 hover:border-clinical-300"
                }`}
              >
                <input
                  type="radio"
                  name="visitHistory"
                  className="h-4 w-4 border-ink-300 text-clinical-600 focus:ring-clinical-400/60"
                  checked={isNewPatient === true}
                  onChange={() => setIsNewPatient(true)}
                />
                {t("visitHistoryFirstTime")}
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm transition ${
                  isNewPatient === false
                    ? "border-clinical-500 bg-clinical-50 text-clinical-900"
                    : "border-ink-200 bg-white text-ink-800 hover:border-clinical-300"
                }`}
              >
                <input
                  type="radio"
                  name="visitHistory"
                  className="h-4 w-4 border-ink-300 text-clinical-600 focus:ring-clinical-400/60"
                  checked={isNewPatient === false}
                  onChange={() => setIsNewPatient(false)}
                />
                {t("visitHistoryReturning")}
              </label>
            </div>
          </fieldset>
          <div className="space-y-2">
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
              onChange={(e) =>
                setVisitReason(
                  e.target.value.slice(0, APPOINTMENT_REASON_MAX_LENGTH)
                )
              }
              placeholder={t("visitReasonPlaceholder")}
              className="w-full resize-y rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-clinical-400/60"
            />
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
            <p className="mt-1 text-xs text-ink-500">
              {t("allTimesInCyprusHint")}
            </p>
          </div>
          <span className="rounded-full bg-clinical-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-clinical-700">
            {t("requestBadge")}
          </span>
        </div>
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
                            onClick={() =>
                              setSelectedSlot(isSelected ? null : slot)
                            }
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
                              className="shrink-0 rounded-xl bg-clinical-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-clinical-400 focus:outline-none focus:ring-2 focus:ring-clinical-400/50"
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
