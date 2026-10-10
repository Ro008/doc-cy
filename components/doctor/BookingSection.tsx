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
import { isValidRegisterEmail, suggestRegisterEmail } from "@/lib/register-email";
import {
  BOOKING_SERVICE_OTHER,
  bookingServiceOptions,
  bookingServiceRequest,
  type BookingServiceItem,
} from "@/lib/booking-service-choice";
import "react-day-picker/dist/style.css";
import { useLocale, useTranslations } from "next-intl";
import {
  PROFILE_SELECT_DAY_EVENT,
  parseProfileDaySelectDetail,
} from "@/lib/public/profile-day-select";

// Public profile theme tokens (light/dark + the doctor's accent, see lib/profile-theme.ts).
const CARD_CLASS =
  "rounded-3xl border border-profile-border bg-profile-surface p-6 text-profile-body shadow-sm";
const LABEL_CLASS = "text-sm font-semibold text-profile-text";
const FIELD_ERROR_CLASS =
  "text-sm font-semibold text-red-600 [.doccy-profile[data-scheme=dark]_&]:text-red-400";
const BOX_ERROR_CLASS =
  "rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800";

/**
 * Every booking field is required (user, 2026-10-02). The star is drawn by CSS, so a
 * label's text stays exactly "Email" for assistive tech and tests; `required` on the
 * field is what screen readers announce.
 */
function RequiredMark() {
  return (
    <span
      aria-hidden="true"
      className="ml-0.5 text-red-600 after:content-['*'] [.doccy-profile[data-scheme=dark]_&]:text-red-400"
    />
  );
}

const CHOICE_CLASS = (selected: boolean, invalid: boolean) =>
  `flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-sm font-medium transition ${
    selected
      ? "border-accent bg-accent-soft text-profile-text"
      : invalid
        ? "border-red-500 bg-profile-surface text-profile-body"
        : "border-profile-border bg-profile-surface text-profile-body hover:border-accent"
  }`;

const INPUT_CLASS = (invalid: boolean) =>
  `w-full rounded-2xl border bg-profile-bg px-3 py-2.5 text-base text-profile-text placeholder:text-profile-muted focus:outline-none focus:ring-2 focus:ring-accent ${
    invalid ? "border-red-500" : "border-profile-border"
  }`;

const RADIO_CLASS = "h-4 w-4 accent-[var(--p-accent-cta)]";

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
  /** The professional's access has ended: same card as paused, without "paused by the professional". */
  onlineBookingsUnavailable?: boolean;
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
  /** Her services: when there are any, the patient picks one (or Other). No prices here. */
  services?: BookingServiceItem[];
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
  onlineBookingsPaused: onlineBookingsPausedProp = false,
  onlineBookingsUnavailable = false,
  publicPhoneAvailable = false,
  holidayModeEnabled = false,
  holidayStartDate = null,
  holidayEndDate = null,
  bookingHorizonDays = 90,
  minimumNoticeHours = 2,
  locationId = null,
  locationLabel = null,
  locationScopedPause = false,
  services = [],
}: BookingSectionProps) {
  const onlineBookingsPaused = onlineBookingsPausedProp || onlineBookingsUnavailable;
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
  // Same checks as /register's email: "Did you mean …?" for a typo in a common provider
  // (sdf@gmai.com → sdf@gmail.com), shown on leaving the field.
  const [emailSuggestion, setEmailSuggestion] = React.useState<string | null>(null);
  const [patientPhone, setPatientPhone] = React.useState("");
  const [phoneValid, setPhoneValid] = React.useState(true);
  const [showPhoneError, setShowPhoneError] = React.useState(false);
  const [isNewPatient, setIsNewPatient] = React.useState<boolean | null>(null);
  const [visitReason, setVisitReason] = React.useState("");
  const serviceOptions = bookingServiceOptions(services, t("serviceOther"));
  /** null: no picker (she lists no services); "": nothing chosen yet; a service id or "other". */
  const [serviceChoice, setServiceChoice] = React.useState<string | null>(
    serviceOptions.length > 0 ? "" : null,
  );
  // The free text is optional once one of her services is picked; required with Other,
  // with nothing picked yet, or when she lists no services.
  const reasonOptional =
    serviceChoice !== null && serviceChoice !== "" && serviceChoice !== BOOKING_SERVICE_OTHER;
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

  // Confirm opens the details form: bring its top ("Your details") into view.
  const contactFormRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!showContactForm) return;
    const card = contactFormRef.current;
    if (!card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [showContactForm]);

  // Picking a time brings the Confirm bar into view (above the bottom fade), unless it
  // already is; instant for people who reduce motion.
  const confirmBarRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!selectedSlot || showContactForm) return;
    const bar = confirmBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const hiddenBelow = rect.bottom > window.innerHeight - 80;
    if (!hiddenBelow && rect.top >= 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bar.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }, [selectedSlot, showContactForm]);

  // A next-availability day card in the profile hero opens that day here.
  React.useEffect(() => {
    const onSelectDay = (event: Event) => {
      const dateKey = parseProfileDaySelectDetail((event as CustomEvent).detail);
      if (!dateKey) return;
      const [y, m, d] = dateKey.split("-").map(Number);
      setSelectedDate(new Date(y, m - 1, d));
      setSelectedSlot(null);
      setShowContactForm(false);
      setError(null);
    };
    window.addEventListener(PROFILE_SELECT_DAY_EVENT, onSelectDay);
    return () => window.removeEventListener(PROFILE_SELECT_DAY_EVENT, onSelectDay);
  }, []);

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
    professionalService: "professionalService",
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
        serviceChoice,
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
            ...bookingServiceRequest({ choice: serviceChoice, services, visitReason: reasonTrim }),
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
        setServiceChoice(serviceOptions.length > 0 ? "" : null);
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
      serviceChoice,
      services,
      doctorId,
      doctorName,
      locationId,
      t,
    ]
  );

  if (onlineBookingsPaused) {
    return (
      <div className={CARD_CLASS}>
        <h2 className="text-xl font-extrabold text-profile-text">
          {t("bookingsTemporarilyUnavailable")}
        </h2>
        <p className="mt-2 text-sm text-profile-muted">
          {onlineBookingsUnavailable
            ? t("appointmentsUnavailable")
            : locationScopedPause
              ? t("appointmentsPausedAtLocation")
              : t("appointmentsPaused")}
        </p>
        {publicPhoneAvailable ? (
          <p className="mt-2 text-sm font-medium text-profile-body">
            {t("appointmentsPausedCallHint")}
          </p>
        ) : null}
      </div>
    );
  }

  if (!weeklySlots || weeklySlots.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <h2 className="text-xl font-extrabold text-profile-text">
          {t("title")}
        </h2>
        <p className="mt-2 text-sm text-profile-muted">
          {t("availabilityNotPublished", {doctorName})}
        </p>
      </div>
    );
  }

  if (upcomingSlots.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <h2 className="text-xl font-extrabold text-profile-text">
          {t("bookingsTemporarilyUnavailable")}
        </h2>
        <p className="mt-2 text-sm text-profile-muted">
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
        className="scroll-mt-24 rounded-3xl border border-profile-border bg-accent-soft p-8 text-profile-body sm:p-10"
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <Clock
              className="relative h-20 w-20 text-accent-link sm:h-24 sm:w-24"
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
          <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-profile-text sm:text-3xl">
            {checkEmailAddress ? t("checkEmailTitle") : t("requestSubmittedTitle")}
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-profile-body">
            {checkEmailAddress
              ? t("checkEmailMessage", { email: checkEmailAddress, doctorName })
              : t("requestSubmittedMessage", { doctorName })}
          </p>
          {checkEmailAddress ? (
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-profile-muted">{t("checkEmailHint")}</p>
          ) : null}
          {/* Done shows the calendar again in place: a link to this same profile URL did nothing. */}
          <button
            type="button"
            onClick={startOver}
            data-testid="booking-success-done"
            className="mt-8 w-full max-w-xs rounded-2xl bg-accent-cta px-6 py-3 text-sm font-bold text-accent-on-cta transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
      <div ref={contactFormRef} className={`${CARD_CLASS} scroll-mt-20`}>
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-profile-text">
              {t("yourDetails")}
            </h2>
            <p className="mt-1 text-sm text-profile-muted">
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
            className="min-h-11 rounded-xl px-2 text-sm font-semibold text-accent-link transition hover:underline"
          >
            {t("changeTime")}
          </button>
        </div>
        {/* noValidate: our own messages under each field, not the browser's generic bubble. */}
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <div id="field-patientName" className="scroll-mt-24 space-y-2">
            <label
              htmlFor="name"
              className={LABEL_CLASS}
            >
              {t("patientFullNameLabel")}
              <RequiredMark />
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
              autoComplete="name"
              className={INPUT_CLASS(Boolean(errorFor("patientName")))}
              placeholder={t("patientFullNamePlaceholder")}
            />
            {errorFor("patientName") ? (
              <p id="name-error" role="alert" className={FIELD_ERROR_CLASS}>
                {errorFor("patientName")}
              </p>
            ) : null}
          </div>
          <div id="field-patientEmail" className="scroll-mt-24 space-y-2">
            <label
              htmlFor="email"
              className={LABEL_CLASS}
            >
              {t("emailLabel")}
              <RequiredMark />
            </label>
            <input
              id="email"
              type="email"
              required
              value={patientEmail}
              onChange={(e) => {
                setPatientEmail(e.target.value);
                setEmailSuggestion(null);
                fixed("patientEmail");
              }}
              onBlur={(e) => {
                const value = e.currentTarget.value;
                setEmailSuggestion(suggestRegisterEmail(value));
                // A malformed address is flagged on leaving the field, not only on send.
                if (value.trim() && !isValidRegisterEmail(value)) {
                  setFieldError({ field: "patientEmail", messageKey: "validEmail" });
                }
              }}
              autoComplete="email"
              aria-invalid={errorFor("patientEmail") ? true : undefined}
              aria-describedby={errorFor("patientEmail") ? "email-error" : undefined}
              className={INPUT_CLASS(Boolean(errorFor("patientEmail")))}
              placeholder={t("emailPlaceholder")}
            />
            {errorFor("patientEmail") ? (
              <p id="email-error" role="alert" className={FIELD_ERROR_CLASS}>
                {errorFor("patientEmail")}
              </p>
            ) : null}
            {emailSuggestion ? (
              <p
                data-testid="booking-email-suggestion"
                role="status"
                className="text-sm text-profile-body"
              >
                {t("emailDidYouMean")}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setPatientEmail(emailSuggestion);
                    setEmailSuggestion(null);
                    fixed("patientEmail");
                  }}
                  className="font-bold text-accent-link underline underline-offset-2"
                >
                  {emailSuggestion}
                </button>
                ?
              </p>
            ) : null}
          </div>
          <div id="field-patientPhone" className="scroll-mt-24 space-y-2">
            <PhoneInput
              id="phone"
              label={
                <>
                  {t("phonePriorityContactLabel")}
                  <RequiredMark />
                </>
              }
              tone="profile"
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
            <legend className={LABEL_CLASS}>
              {t("visitHistoryLabel", { doctorName })}
              <RequiredMark />
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={CHOICE_CLASS(isNewPatient === true, Boolean(errorFor("isNewPatient")))}
              >
                <input
                  id="visitHistory-first"
                  type="radio"
                  name="visitHistory"
                  className={RADIO_CLASS}
                  checked={isNewPatient === true}
                  onChange={() => {
                    setIsNewPatient(true);
                    fixed("isNewPatient");
                  }}
                />
                {t("visitHistoryFirstTime")}
              </label>
              <label
                className={CHOICE_CLASS(isNewPatient === false, Boolean(errorFor("isNewPatient")))}
              >
                <input
                  type="radio"
                  name="visitHistory"
                  className={RADIO_CLASS}
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
              <p id="visitHistory-error" role="alert" className={FIELD_ERROR_CLASS}>
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
            <legend className={LABEL_CLASS}>
              {t("genderLabel")}
              <RequiredMark />
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
                  className={CHOICE_CLASS(patientGender === value, Boolean(errorFor("patientGender")))}
                >
                  <input
                    id={`patientGender-${value}`}
                    type="radio"
                    name="patientGender"
                    value={value}
                    className={RADIO_CLASS}
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
              <p id="patientGender-error" role="alert" className={FIELD_ERROR_CLASS}>
                {errorFor("patientGender")}
              </p>
            ) : null}
          </fieldset>
          <div id="field-patientBirthdate" className="scroll-mt-24 space-y-2">
            <label htmlFor="patientBirthdate" className={LABEL_CLASS}>
              {t("birthdateLabel")}
              <RequiredMark />
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
              autoComplete="bday"
              className={`${INPUT_CLASS(Boolean(errorFor("patientBirthdate")))} [color-scheme:inherit]`}
            />
            {errorFor("patientBirthdate") ? (
              <p id="patientBirthdate-error" role="alert" className={FIELD_ERROR_CLASS}>
                {errorFor("patientBirthdate")}
              </p>
            ) : null}
            <p className="text-xs leading-relaxed text-profile-muted">
              {t("personalDetailsPrivacyNote", { doctorName })}
            </p>
          </div>
          {serviceChoice !== null ? (
            <div id="field-professionalService" className="scroll-mt-24 space-y-2">
              <label htmlFor="professionalService" className={LABEL_CLASS}>
                {t("serviceLabel")}
                <RequiredMark />
              </label>
              <select
                id="professionalService"
                required
                value={serviceChoice}
                onChange={(e) => {
                  setServiceChoice(e.target.value);
                  fixed("professionalService");
                  fixed("visitReason");
                }}
                aria-invalid={errorFor("professionalService") ? true : undefined}
                aria-describedby={errorFor("professionalService") ? "professionalService-error" : undefined}
                className={`${INPUT_CLASS(Boolean(errorFor("professionalService")))} [color-scheme:inherit] ${
                  serviceChoice === "" ? "text-profile-muted" : ""
                }`}
              >
                <option value="" disabled>
                  {t("servicePlaceholder")}
                </option>
                {serviceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errorFor("professionalService") ? (
                <p id="professionalService-error" role="alert" className={FIELD_ERROR_CLASS}>
                  {errorFor("professionalService")}
                </p>
              ) : null}
            </div>
          ) : null}
          {/* Always there: the patient's own words. Optional once she picked one of the
              professional's services; required with Other or when there are no services
              (user, 2026-10-09). */}
          <div id="field-visitReason" className="scroll-mt-24 space-y-2">
            <label htmlFor="visitReason" className={LABEL_CLASS}>
              {reasonOptional
                ? t("visitNotesOptionalLabel", { doctorName })
                : serviceChoice === BOOKING_SERVICE_OTHER
                  ? t("serviceOtherReasonLabel")
                  : t("visitReasonLabel")}
              {reasonOptional ? null : <RequiredMark />}
            </label>
            <textarea
              id="visitReason"
              required={!reasonOptional}
              rows={4}
              maxLength={APPOINTMENT_REASON_MAX_LENGTH}
              value={visitReason}
              onChange={(e) => {
                setVisitReason(e.target.value.slice(0, APPOINTMENT_REASON_MAX_LENGTH));
                fixed("visitReason");
              }}
              aria-invalid={errorFor("visitReason") ? true : undefined}
              aria-describedby={errorFor("visitReason") ? "visitReason-error" : undefined}
              placeholder={reasonOptional ? t("visitNotesOptionalPlaceholder") : t("visitReasonPlaceholder")}
              className={`${INPUT_CLASS(Boolean(errorFor("visitReason")))} resize-y`}
            />
            {errorFor("visitReason") ? (
              <p id="visitReason-error" role="alert" className={FIELD_ERROR_CLASS}>
                {errorFor("visitReason")}
              </p>
            ) : null}
            <p className="text-right text-xs text-profile-muted">
              {visitReason.length}/{APPOINTMENT_REASON_MAX_LENGTH}
            </p>
          </div>
          {error && (
            <div
              data-testid="booking-error-message"
              className={BOX_ERROR_CLASS}
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-accent-cta px-4 py-3 text-base font-bold text-accent-on-cta transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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

  // Calendar + time chips
  const isDateAvailable = (date: Date) =>
    availableDates.some(
      (d) => format(d, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    );
  const selectedDayKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;

  return (
    <div className="rounded-3xl border border-profile-border bg-profile-surface text-profile-body shadow-sm">
      <div className="border-b border-profile-border px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-profile-text sm:text-2xl">
              {t("title")}
            </h2>
            {locationLabel ? (
              <>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-accent-link">
                  {t("pickTimeStep")}
                </p>
                <p className="mt-1 text-sm font-semibold text-profile-text">
                  {t("timesOnlyForClinic", { clinic: locationLabel })}
                </p>
              </>
            ) : null}
            <p className="mt-1 text-sm text-profile-muted">
              {t("allTimesInCyprusHint")}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-profile-text">
            {t("requestBadge")}
          </span>
        </div>
        {error ? (
          <div
            data-testid="booking-error-message"
            className={`mt-3 ${BOX_ERROR_CLASS}`}
          >
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-profile-muted">
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
            className="rdp-profile"
            classNames={{
              root: "p-0",
              caption: "flex justify-between items-center mb-4",
              caption_label: "text-base font-bold",
              nav: "flex gap-1",
              nav_button_previous: "rounded-xl p-2 transition hover:opacity-80",
              nav_button_next: "rounded-xl p-2 transition hover:opacity-80",
              month: "w-full",
              day: "m-0.5 h-10 w-10 rounded-full text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
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

        <div className="min-w-0">
          {!selectedDate ? (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-profile-border px-4 py-12 text-center">
              <p className="text-sm font-semibold text-profile-text">
                {t("selectDateOnCalendar")}
              </p>
              <p className="mt-1 text-sm text-profile-muted">
                {t("availableTimesHere")}
              </p>
            </div>
          ) : (
            <>
              <p
                data-testid="booking-selected-day"
                data-date={selectedDayKey ?? ""}
                className="mb-3 text-base font-bold capitalize text-profile-text"
              >
                {format(selectedDate, "EEEE, d MMMM", { locale: dateFnsLocale })}
              </p>
              {slotsForSelectedDay.length === 0 ? (
                <p className="py-6 text-sm text-profile-muted">
                  {t("noAvailableTimesThisDay")}
                </p>
              ) : (
                <div
                  key={selectedDayKey ?? "none"}
                  className="grid grid-cols-3 gap-2 sm:grid-cols-4"
                >
                  {slotsForSelectedDay.map((slot, index) => {
                    const isSelected = selectedSlot?.key === slot.key;
                    return (
                      <button
                        key={slot.key}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedSlot(isSelected ? null : slot);
                          setError(null);
                        }}
                        style={{ "--rise-i": Math.min(index, 12) } as React.CSSProperties}
                        className={`profile-rise min-h-12 rounded-2xl border-2 text-base font-bold tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          isSelected
                            ? "profile-pop border-accent-cta bg-accent-cta text-accent-on-cta"
                            : "border-accent-soft bg-profile-surface text-profile-text hover:border-accent"
                        }`}
                      >
                        {slot.labelTime}
                        <span className="sr-only">
                          {" "}
                          {isSelected ? t("timeSlotSelected") : t("timeSlotSelect")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedSlot ? (
        <div
          ref={confirmBarRef}
          className="profile-rise flex scroll-mb-24 flex-col gap-3 border-t border-profile-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm font-semibold text-profile-text">
            {selectedSlot.labelFull}
            {locationLabel ? ` · ${locationLabel}` : ""}
          </p>
          <button
            type="button"
            onClick={() => setShowContactForm(true)}
            className="min-h-[52px] rounded-2xl bg-accent-cta px-7 text-base font-bold text-accent-on-cta transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Confirm
          </button>
        </div>
      ) : null}
    </div>
  );
}
