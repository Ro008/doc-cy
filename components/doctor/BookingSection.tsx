// components/doctor/BookingSection.tsx
"use client";

import * as React from "react";
import {
  addMinutes,
  format,
  isBefore,
  isSameDay,
} from "date-fns";
import { enGB } from "date-fns/locale";
import { PhoneInput } from "@/components/ui/PhoneInput";

type WeeklySlot = {
  id: string;
  day_of_week: number; // 0-6
  start_time: string; // "09:00:00"
  end_time: string; // "17:00:00"
  duration: number; // minutes
};

type BookingSectionProps = {
  doctorId: string;
  doctorName: string;
  weeklySlots: WeeklySlot[];
};

type SlotOption = {
  key: string;
  date: Date;
  labelTime: string;
  labelFull: string;
};

export function BookingSection({
  doctorId,
  doctorName,
  weeklySlots,
}: BookingSectionProps) {
  const [selectedSlot, setSelectedSlot] = React.useState<SlotOption | null>(
    null
  );
  const [patientName, setPatientName] = React.useState("");
  const [patientEmail, setPatientEmail] = React.useState("");
  const [patientPhone, setPatientPhone] = React.useState("");
  const [phoneValid, setPhoneValid] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null
  );

  // Build available slots for the next 7 days based on weeklySlots
  const upcomingSlots: SlotOption[] = React.useMemo(() => {
    const result: SlotOption[] = [];
    const now = new Date();

    for (let offset = 0; offset < 7; offset++) {
      const day = new Date();
      day.setDate(now.getDate() + offset);
      day.setHours(0, 0, 0, 0);
      const dayOfWeek = day.getDay();

      const daySlots = weeklySlots.filter(
        (s) => s.day_of_week === dayOfWeek
      );

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
            const key = cursor.toISOString();
            result.push({
              key,
              date: cursor,
              labelTime: format(cursor, "HH:mm"),
              labelFull: format(cursor, "EEE d MMM, HH:mm", {
                locale: enGB,
              }),
            });
          }

          cursor = addMinutes(cursor, s.duration);
        }
      }
    }

    return result;
  }, [weeklySlots]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!selectedSlot) {
      setError("Please select a time slot.");
      return;
    }
    if (!patientName || !patientEmail || !patientPhone) {
      setError("Please complete all patient details.");
      return;
    }
    if (!phoneValid) {
      setError("Please enter a valid phone number.");
      return;
    }

    try {
      setSubmitting(true);

      const appointmentLocal = format(selectedSlot.date, "yyyy-MM-dd'T'HH:mm");

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId,
          patientName,
          patientEmail,
          patientPhone,
          appointmentLocal,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);

        if (res.status === 409) {
          setError(
            "This time slot has just been booked. Please choose another slot."
          );
        } else {
          setError(
            data?.message ||
              "We could not complete your booking. Please try again."
          );
        }
        return;
      }

      setSuccessMessage(
        "Your appointment has been booked successfully. You will receive a confirmation shortly."
      );
      setSelectedSlot(null);
      setPatientName("");
      setPatientEmail("");
      setPatientPhone("");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!weeklySlots || weeklySlots.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Book an appointment
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          This doctor has not published any availability yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Book an appointment
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        All times shown are local to Cyprus.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Select a time
          </p>
          {upcomingSlots.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No upcoming availability for the next days.
            </p>
          ) : (
            <div className="mt-3 flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
              {upcomingSlots.map((slot) => (
                <button
                  key={slot.key}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                    selectedSlot?.key === slot.key
                      ? "border-sky-600 bg-sky-50 text-sky-900"
                      : "border-slate-200 bg-white text-slate-800 hover:border-sky-400 hover:bg-sky-50"
                  }`}
                >
                  <span>{slot.labelFull}</span>
                  {selectedSlot?.key === slot.key && (
                    <span className="text-xs font-medium text-sky-700">
                      Selected
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <form className="space-y-4 pt-2" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-xs font-semibold text-slate-700"
            >
              Full name
            </label>
            <input
              id="name"
              type="text"
              required
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-xs font-semibold text-slate-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
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
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          {successMessage && (
            <p className="text-sm text-emerald-700">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || upcomingSlots.length === 0}
            className="inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? "Booking..." : "Book appointment"}
          </button>
        </form>
      </div>
    </div>
  );
}

