"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { SpecialtyCombobox } from "@/components/specialties/SpecialtyCombobox";
import { LanguageMultiSelect } from "@/components/languages/LanguageMultiSelect";
import { isMasterSpecialty } from "@/lib/cyprus-specialties";
import { validateSpecialtySubmission } from "@/lib/specialty-submission";
import {
  BOOKING_HORIZON_OPTIONS_DAYS,
  DEFAULT_BOOKING_HORIZON_DAYS,
  DAY_NAMES,
  DEFAULT_MIN_NOTICE_HOURS,
  MIN_NOTICE_OPTIONS_HOURS,
  type DayKey,
  type WeeklySchedule,
} from "@/lib/doctor-settings";
import {
  formatISOToDDMMYYYYOrEmpty,
  parseDDMMYYYYToISO,
} from "@/lib/date-format";

export type DoctorSettingsFormData = {
  doctorId: string;
  doctorName: string;
  /** Shown in directory & public profile */
  specialty: string;
  /** false = custom “Other” text pending founder approval */
  isSpecialtyApproved?: boolean;
  /** Canonical labels, saved as string[] on doctors */
  languages: string[];
  whatsappNumber?: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  weeklySchedule: WeeklySchedule;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
  slotDurationMinutes: number;
  bookingHorizonDays: number;
  minimumNoticeHours: number;
  holidayModeEnabled: boolean;
  holidayStartDate: string | null; // "YYYY-MM-DD"
  holidayEndDate: string | null; // "YYYY-MM-DD"
};

type SettingsFormProps = {
  initial: DoctorSettingsFormData;
};

function timeToInputValue(t: string | null | undefined): string {
  if (!t) return "09:00";
  const parts = String(t).split(":");
  const h = parts[0]?.padStart(2, "0") ?? "09";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  return `${h}:${m}`;
}

const DAY_LABELS: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export function SettingsForm({ initial }: SettingsFormProps) {
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [spec, setSpec] = React.useState(() => {
    const s = (initial.specialty ?? "").trim();
    const fromMaster =
      (initial.isSpecialtyApproved ?? true) !== false && isMasterSpecialty(s);
    return { specialty: s, fromMaster };
  });
  const onSpecChange = React.useCallback(
    (p: { specialty: string; fromMaster: boolean }) => {
      setSpec(p);
    },
    []
  );

  const [languages, setLanguages] = React.useState<string[]>(() =>
    Array.isArray(initial.languages) ? [...initial.languages] : []
  );

  const [whatsappNumber, setWhatsappNumber] = React.useState(
    initial.whatsappNumber ?? ""
  );

  const [weeklySchedule, setWeeklySchedule] = React.useState<WeeklySchedule>(
    initial.weeklySchedule
  );
  const [breakEnabled, setBreakEnabled] = React.useState(
    initial.breakEnabled
  );
  const [breakStart, setBreakStart] = React.useState(
    timeToInputValue(initial.breakStart)
  );
  const [breakEnd, setBreakEnd] = React.useState(
    timeToInputValue(initial.breakEnd)
  );
  const [slotDurationMinutes, setSlotDurationMinutes] = React.useState(
    initial.slotDurationMinutes
  );
  const [bookingHorizonDays, setBookingHorizonDays] = React.useState(
    initial.bookingHorizonDays
  );
  const [minimumNoticeHours, setMinimumNoticeHours] = React.useState(
    initial.minimumNoticeHours
  );
  const [holidayModeEnabled, setHolidayModeEnabled] = React.useState(
    initial.holidayModeEnabled
  );
  const [holidayStartDate, setHolidayStartDate] = React.useState<
    string | null
  >(initial.holidayStartDate);
  const [holidayEndDate, setHolidayEndDate] = React.useState<string | null>(
    initial.holidayEndDate
  );
  const [holidayStartInput, setHolidayStartInput] = React.useState(
    formatISOToDDMMYYYYOrEmpty(initial.holidayStartDate)
  );
  const [holidayEndInput, setHolidayEndInput] = React.useState(
    formatISOToDDMMYYYYOrEmpty(initial.holidayEndDate)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const langList = languages.filter((s) => s.trim().length > 0);
    const specResult = validateSpecialtySubmission(
      spec.specialty,
      spec.fromMaster
    );
    if (specResult.ok === false) {
      setMessage({ type: "error", text: specResult.message });
      return;
    }
    if (langList.length === 0) {
      setMessage({
        type: "error",
        text: "Add at least one language (e.g. English, Greek).",
      });
      return;
    }

    const parsedHolidayStart = holidayModeEnabled
      ? parseDDMMYYYYToISO(holidayStartInput)
      : null;
    const parsedHolidayEnd = holidayModeEnabled
      ? parseDDMMYYYYToISO(holidayEndInput)
      : null;

    if (holidayModeEnabled) {
      if (!parsedHolidayStart || !parsedHolidayEnd) {
        setMessage({
          type: "error",
          text: "Use DD/MM/YYYY for Holiday start and end.",
        });
        return;
      }
      if (parsedHolidayStart > parsedHolidayEnd) {
        setMessage({
          type: "error",
          text: "Holiday start date must be before (or equal to) end date.",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/doctor-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: initial.doctorId,
          doctorPhone: whatsappNumber || null,
          specialty: specResult.specialty,
          specialtyFromMaster: specResult.is_specialty_approved,
          languages: langList,
          monday: weeklySchedule.monday.enabled,
          tuesday: weeklySchedule.tuesday.enabled,
          wednesday: weeklySchedule.wednesday.enabled,
          thursday: weeklySchedule.thursday.enabled,
          friday: weeklySchedule.friday.enabled,
          saturday: weeklySchedule.saturday.enabled,
          sunday: weeklySchedule.sunday.enabled,
          weeklySchedule,
          breakEnabled,
          breakStart,
          breakEnd,
          slotDurationMinutes,
          bookingHorizonDays,
          minimumNoticeHours,
          holidayModeEnabled,
          holidayStartDate: parsedHolidayStart,
          holidayEndDate: parsedHolidayEnd,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          type: "error",
          text: (data.message as string) || "Failed to save settings.",
        });
        return;
      }
      if (holidayModeEnabled) {
        setHolidayStartDate(parsedHolidayStart);
        setHolidayEndDate(parsedHolidayEnd);
      }
      setMessage({ type: "success", text: "Settings saved." });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  const days = DAY_NAMES.map((key) => ({
    key,
    label: DAY_LABELS[key],
    value: weeklySchedule[key].enabled,
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Directory &amp; profile
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Required so patients can find you by specialty and language.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Specialty <span className="text-red-300">*</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Search the list or choose Other if needed — custom entries are reviewed.
            </p>
            <SpecialtyCombobox
              id="settings-specialty"
              initialSpecialty={initial.specialty ?? ""}
              initialIsApproved={initial.isSpecialtyApproved ?? true}
              variant="settings"
              onSelectionChange={onSpecChange}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Languages <span className="text-red-300">*</span>
            </p>
            <LanguageMultiSelect
              id="settings-languages"
              selected={languages}
              onSelectedChange={setLanguages}
              variant="settings"
              requiredHint
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <label
          htmlFor="whatsappNumber"
          className="text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          WhatsApp Number (with country code, e.g., +357...)
        </label>
        <input
          id="whatsappNumber"
          type="text"
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value)}
          placeholder="+357..."
          className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
        />
        <p className="mt-2 text-xs text-slate-400">
          Used in appointment confirmation emails to enable{" "}
          <span className="font-medium text-slate-300">Chat on WhatsApp</span>.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Working days
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Select the days you see patients.
        </p>
        <div className="mt-4 space-y-3">
          {days.map(({ key, label, value }) => (
            <div
              key={key}
              className="rounded-xl border border-slate-800/70 bg-slate-950/30 p-3"
            >
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) =>
                    setWeeklySchedule((prev) => ({
                      ...prev,
                      [key]: { ...prev[key], enabled: e.target.checked },
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400/60"
                />
                <span className="text-sm text-slate-200">{label}</span>
              </label>

              {value && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`${key}-start`}
                      className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                    >
                      Start time
                    </label>
                    <input
                      id={`${key}-start`}
                      type="time"
                      value={timeToInputValue(weeklySchedule[key].start_time)}
                      onChange={(e) =>
                        setWeeklySchedule((prev) => ({
                          ...prev,
                          [key]: {
                            ...prev[key],
                            start_time: `${e.target.value}:00`,
                          },
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`${key}-end`}
                      className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                    >
                      End time
                    </label>
                    <input
                      id={`${key}-end`}
                      type="time"
                      value={timeToInputValue(weeklySchedule[key].end_time)}
                      onChange={(e) =>
                        setWeeklySchedule((prev) => ({
                          ...prev,
                          [key]: {
                            ...prev[key],
                            end_time: `${e.target.value}:00`,
                          },
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Scheduling Boundaries
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="bookingHorizonDays"
              className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              Future booking limit
            </label>
            <select
              id="bookingHorizonDays"
              value={bookingHorizonDays}
              onChange={(e) => {
                const next = Number(e.target.value);
                setBookingHorizonDays(
                  BOOKING_HORIZON_OPTIONS_DAYS.includes(
                    next as (typeof BOOKING_HORIZON_OPTIONS_DAYS)[number]
                  )
                    ? next
                    : DEFAULT_BOOKING_HORIZON_DAYS
                );
              }}
              className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            >
              <option value={14}>2 weeks</option>
              <option value={30}>1 month</option>
              <option value={90}>3 months</option>
              <option value={180}>6 months</option>
            </select>
            <p className="mt-2 text-xs text-slate-400">
              How far in advance patients can book.
            </p>
          </div>
          <div>
            <label
              htmlFor="minimumNoticeHours"
              className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              Minimum notice period
            </label>
            <select
              id="minimumNoticeHours"
              value={minimumNoticeHours}
              onChange={(e) => {
                const next = Number(e.target.value);
                setMinimumNoticeHours(
                  MIN_NOTICE_OPTIONS_HOURS.includes(
                    next as (typeof MIN_NOTICE_OPTIONS_HOURS)[number]
                  )
                    ? next
                    : DEFAULT_MIN_NOTICE_HOURS
                );
              }}
              className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            >
              <option value={1}>1 hour</option>
              <option value={2}>2 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
            </select>
            <p className="mt-2 text-xs text-slate-400">
              Prevent last-minute surprises. Slots will be hidden if they are too close to the current time.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Holiday Mode
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Completely block bookings during a date range.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={holidayModeEnabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                setHolidayModeEnabled(enabled);
                if (!enabled) {
                  setHolidayStartDate(null);
                  setHolidayEndDate(null);
                  setHolidayStartInput("");
                  setHolidayEndInput("");
                }
              }}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400/60"
            />
            <span>Enable</span>
          </label>
        </div>

        {holidayModeEnabled && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="holidayStart"
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
              >
                Holiday start
              </label>
              <input
                id="holidayStart"
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/YYYY"
                value={holidayStartInput}
                onChange={(e) => {
                  setHolidayStartInput(e.target.value);
                  const parsed = parseDDMMYYYYToISO(e.target.value);
                  setHolidayStartDate(parsed);
                }}
                className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </div>
            <div>
              <label
                htmlFor="holidayEnd"
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
              >
                Holiday end
              </label>
              <input
                id="holidayEnd"
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/YYYY"
                value={holidayEndInput}
                onChange={(e) => {
                  setHolidayEndInput(e.target.value);
                  const parsed = parseDDMMYYYYToISO(e.target.value);
                  setHolidayEndDate(parsed);
                }}
                className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Daily break (optional)
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Patients will not be able to book during this time.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={breakEnabled}
              onChange={(e) => setBreakEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400/60"
            />
            <span>Add a daily break</span>
          </label>
        </div>
        {breakEnabled && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="breakStart"
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
              >
                Break start
              </label>
              <input
                id="breakStart"
                type="time"
                value={breakStart}
                onChange={(e) => setBreakStart(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </div>
            <div>
              <label
                htmlFor="breakEnd"
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
              >
                Break end
              </label>
              <input
                id="breakEnd"
                type="time"
                value={breakEnd}
                onChange={(e) => setBreakEnd(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <label
          htmlFor="slotDuration"
          className="text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          Appointment slot duration (minutes)
        </label>
        <p className="mt-1 text-sm text-slate-300">
          e.g. 30 for 30-minute slots.
        </p>
        <select
          id="slotDuration"
          value={slotDurationMinutes}
          onChange={(e) =>
            setSlotDurationMinutes(Number(e.target.value))
          }
          className="mt-3 w-full max-w-xs rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
        >
          {[15, 20, 30, 45, 60].map((n) => (
            <option key={n} value={n}>
              {n} min
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
              : "border-red-500/20 bg-red-500/10 text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300 disabled:opacity-60"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save settings"}
        </button>
        <Link
          href="/agenda"
          className="inline-flex items-center text-sm text-slate-400 transition hover:text-slate-200"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to agenda
        </Link>
      </div>
    </form>
  );
}
