"use client";

import * as React from "react";
import Link from "next/link";
import {
  addMinutes,
  format,
  isBefore,
  isSameDay,
  startOfDay,
} from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { enGB } from "date-fns/locale";
import { DayPicker } from "react-day-picker";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { CY_TZ } from "@/lib/appointments";
import "react-day-picker/dist/style.css";

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
};

type SlotOption = {
  key: string;
  date: Date;
  labelTime: string;
  labelFull: string;
  slotKey: string;
};

const CALENDAR_DAYS_AHEAD = 45;

export function BookingSection({
  doctorId,
  doctorName,
  weeklySlots,
  takenSlotTimes = [],
  profileSlug,
  breakStart,
  breakEnd,
}: BookingSectionProps) {
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
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = React.useState(false);
  const [lastAppointmentId, setLastAppointmentId] = React.useState<string | null>(
    null
  );

  // Build all slots for the next CALENDAR_DAYS_AHEAD days
  const upcomingSlots: SlotOption[] = React.useMemo(() => {
    const result: SlotOption[] = [];
    const now = new Date();

    for (let offset = 0; offset < CALENDAR_DAYS_AHEAD; offset++) {
      const day = new Date(now);
      day.setDate(now.getDate() + offset);
      day.setHours(0, 0, 0, 0);
      const dayOfWeek = day.getDay();
      const daySlots = weeklySlots.filter((s) => s.day_of_week === dayOfWeek);

      for (const s of daySlots) {
        const [startHour, startMinute] = s.start_time.split(":").map(Number);
        const [endHour, endMinute] = s.end_time.split(":").map(Number);
        let cursor = new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          startHour,
          startMinute,
          0,
          0
        );
        const end = new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          endHour,
          endMinute,
          0,
          0
        );

        while (isBefore(cursor, end)) {
          if (!isSameDay(cursor, now) || !isBefore(cursor, now)) {
            const cyprusCursor = utcToZonedTime(cursor, CY_TZ);
            const timeLabel = format(cyprusCursor, "HH:mm");

            // Skip slots that fall inside the doctor's daily break window
            if (
              breakStart &&
              breakEnd &&
              timeLabel >= breakStart &&
              timeLabel < breakEnd
            ) {
              cursor = addMinutes(cursor, s.duration);
              continue;
            }

            const slotKey = format(cyprusCursor, "yyyy-MM-dd'T'HH:mm");
            result.push({
              key: cursor.toISOString(),
              date: cursor,
              labelTime: timeLabel,
              labelFull: format(cyprusCursor, "EEE d MMM, HH:mm", {
                locale: enGB,
              }),
              slotKey,
            });
          }
          cursor = addMinutes(cursor, s.duration);
        }
      }
    }
    return result;
  }, [weeklySlots, breakStart, breakEnd]);

  const isSlotTaken = (slot: SlotOption) => takenSet.has(slot.slotKey);

  // Dates that have at least one available (non-taken) slot
  const availableDates = React.useMemo(() => {
    const dateSet = new Set<string>();
    upcomingSlots.forEach((slot) => {
      if (!isSlotTaken(slot)) {
        dateSet.add(format(startOfDay(slot.date), "yyyy-MM-dd"));
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
      (slot) =>
        format(slot.date, "yyyy-MM-dd") === dayKey && !isSlotTaken(slot)
    );
  }, [selectedDate, upcomingSlots, takenSet]);

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!selectedSlot) {
        setError("Please select a time slot.");
        return;
      }
      if (!patientName || !patientEmail || !patientPhone) {
        setError("Please complete all patient details.");
        return;
      }
      if (!phoneValid) {
        setShowPhoneError(true);
        setError("Please enter a valid phone number.");
        return;
      }
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
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (res.status === 409) {
            setError(
              "This time slot has just been booked. Please choose another slot."
            );
            return;
          }
          setError(
            data?.message ||
              "We could not complete your booking. Please try again."
          );
          return;
        }
        const newId =
          (data?.appointment?.id as string | undefined) ?? null;
        setLastAppointmentId(newId);
        setBookingSuccess(true);
        setSelectedSlot(null);
        setSelectedDate(null);
        setShowContactForm(false);
        setPatientName("");
        setPatientEmail("");
        setPatientPhone("");
        setShowPhoneError(false);
      } catch (err) {
        console.error(err);
        setError("Something went wrong. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      selectedSlot,
      patientName,
      patientEmail,
      patientPhone,
      phoneValid,
      doctorId,
    ]
  );

  if (!weeklySlots || weeklySlots.length === 0) {
    return (
      <div className="rounded-3xl border border-emerald-100/10 bg-slate-900/50 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-slate-50">
          Book an appointment
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          {doctorName} has not published availability yet.
        </p>
      </div>
    );
  }

  if (bookingSuccess) {
    return (
      <div
        data-testid="booking-success-message"
        data-appointment-id={lastAppointmentId ?? ""}
        className="rounded-3xl border border-emerald-200/20 bg-slate-900/60 p-8 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl sm:p-10"
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute inset-0 scale-150 rounded-full bg-emerald-400/20 blur-2xl" />
            <CheckCircle2
              className="relative h-20 w-20 text-emerald-400 sm:h-24 sm:w-24"
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
            Booking Confirmed!
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
            {doctorName} has been notified. You will receive a WhatsApp
            confirmation shortly.
          </p>
          {profileSlug ? (
            <Link
              href={`/${profileSlug}`}
              className="mt-8 flex w-full max-w-xs items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-200 shadow-lg shadow-emerald-500/10 transition hover:border-emerald-400/60 hover:bg-emerald-400/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Done
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setBookingSuccess(false)}
              className="mt-8 w-full max-w-xs rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-200 shadow-lg shadow-emerald-500/10 transition hover:border-emerald-400/60 hover:bg-emerald-400/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Done
            </button>
          )}
        </div>
      </div>
    );
  }

  // Contact form step (after Confirm on time slot)
  if (showContactForm && selectedSlot) {
    return (
      <div className="rounded-3xl border border-emerald-100/10 bg-slate-900/50 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">
              Your details
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {selectedSlot.labelFull} · Cyprus time
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowContactForm(false);
              setError(null);
            }}
            className="text-xs font-medium text-slate-400 transition hover:text-emerald-300"
          >
            Change time
          </button>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-xs font-semibold text-slate-200"
            >
              Full name
            </label>
            <input
              id="name"
              type="text"
              required
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full rounded-2xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 shadow-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-xs font-semibold text-slate-200"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 shadow-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              placeholder="you@email.com"
            />
          </div>
          <div className="space-y-2">
            <PhoneInput
              id="phone"
              label="Phone (priority contact)"
              value={patientPhone}
              onChange={(val, isValid) => {
                setPatientPhone(val);
                setPhoneValid(isValid);
                setShowPhoneError(false);
              }}
              showValidationError={showPhoneError}
            />
          </div>
          {error && (
            <div
              data-testid="booking-error-message"
              className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {submitting ? "Booking..." : "Book appointment"}
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
    <div className="rounded-3xl border border-emerald-100/10 bg-slate-900/50 shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
      <div className="border-b border-slate-800/60 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">
              Book an appointment
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              All times in Cyprus · Select a date, then a time
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-200">
            Instant
          </span>
        </div>
      </div>

      <div className="grid gap-6 p-4 sm:grid-cols-2 sm:p-6">
        {/* Left: calendar */}
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/30 p-4 backdrop-blur-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Select a date
          </p>
          <DayPicker
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={(d) => {
              setSelectedDate(d ?? null);
              setSelectedSlot(null);
            }}
            fromDate={new Date()}
            toDate={addMinutes(new Date(), CALENDAR_DAYS_AHEAD * 24 * 60)}
            disabled={(date) => !isDateAvailable(date)}
            locale={enGB}
            captionLayout="buttons"
            className="rdp-dark"
            classNames={{
              root: "p-0",
              caption: "flex justify-between items-center mb-4",
              caption_label: "text-sm font-semibold text-slate-200",
              nav: "flex gap-1",
              nav_button_previous: "rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-300 hover:bg-slate-700/50",
              nav_button_next: "rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-300 hover:bg-slate-700/50",
              month: "w-full",
              day: "p-0.5 w-9 h-9 rounded-full text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:ring-offset-2 focus:ring-offset-slate-900",
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
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/30 p-4 backdrop-blur-sm">
          {!selectedDate ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-slate-400">
                Select a date on the calendar
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Available times will appear here
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {format(selectedDate, "EEEE, d MMMM", { locale: enGB })}
              </p>
              {slotsForSelectedDay.length === 0 ? (
                <p className="py-6 text-sm text-slate-500">
                  No available times this day. Pick another date.
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
                            ? "border-emerald-400/50 bg-emerald-400/10 shadow-inner"
                            : "border-slate-800/80 bg-slate-900/50 hover:border-emerald-400/30 hover:bg-emerald-400/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 p-3">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSlot(isSelected ? null : slot)
                            }
                            className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-slate-200"
                          >
                            <span
                              className="font-mono text-slate-400"
                              style={{ minWidth: "3rem" }}
                            >
                              {slot.labelTime}
                            </span>
                            <span>
                              {isSelected ? "Selected" : "Select"}
                            </span>
                          </button>
                          {isSelected && (
                            <button
                              type="button"
                              onClick={() => setShowContactForm(true)}
                              className="shrink-0 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
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
