"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

export type DoctorSettingsFormData = {
  doctorId: string;
  doctorName: string;
  /** Shown in directory & public profile */
  specialty: string;
  /** Comma- or semicolon-separated, saved as string[] on doctors */
  languages: string;
  whatsappNumber?: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  startTime: string; // "09:00"
  endTime: string;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
  slotDurationMinutes: number;
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

export function SettingsForm({ initial }: SettingsFormProps) {
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [specialty, setSpecialty] = React.useState(initial.specialty ?? "");
  const [languages, setLanguages] = React.useState(initial.languages ?? "");

  const [whatsappNumber, setWhatsappNumber] = React.useState(
    initial.whatsappNumber ?? ""
  );

  const [monday, setMonday] = React.useState(initial.monday);
  const [tuesday, setTuesday] = React.useState(initial.tuesday);
  const [wednesday, setWednesday] = React.useState(initial.wednesday);
  const [thursday, setThursday] = React.useState(initial.thursday);
  const [friday, setFriday] = React.useState(initial.friday);
  const [startTime, setStartTime] = React.useState(
    timeToInputValue(initial.startTime)
  );
  const [endTime, setEndTime] = React.useState(
    timeToInputValue(initial.endTime)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const spec = specialty.trim();
    const langList = languages
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!spec) {
      setMessage({
        type: "error",
        text: "Specialty is required for your public directory listing.",
      });
      return;
    }
    if (langList.length === 0) {
      setMessage({
        type: "error",
        text: "Add at least one language (e.g. English, Greek).",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/doctor-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: initial.doctorId,
          doctorPhone: whatsappNumber || null,
          specialty: spec,
          languages: langList,
          monday,
          tuesday,
          wednesday,
          thursday,
          friday,
          startTime,
          endTime,
          breakEnabled,
          breakStart,
          breakEnd,
          slotDurationMinutes,
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
      setMessage({ type: "success", text: "Settings saved." });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  const days = [
    { key: "monday" as const, label: "Monday", value: monday, set: setMonday },
    { key: "tuesday" as const, label: "Tuesday", value: tuesday, set: setTuesday },
    {
      key: "wednesday" as const,
      label: "Wednesday",
      value: wednesday,
      set: setWednesday,
    },
    {
      key: "thursday" as const,
      label: "Thursday",
      value: thursday,
      set: setThursday,
    },
    { key: "friday" as const, label: "Friday", value: friday, set: setFriday },
  ];

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
            <label
              htmlFor="settingsSpecialty"
              className="text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              Specialty <span className="text-red-300">*</span>
            </label>
            <input
              id="settingsSpecialty"
              name="specialty"
              type="text"
              required
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="e.g. General Practitioner"
              className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            />
          </div>
          <div>
            <label
              htmlFor="settingsLanguages"
              className="text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              Languages <span className="text-red-300">*</span>
            </label>
            <input
              id="settingsLanguages"
              name="languages"
              type="text"
              required
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              placeholder="e.g. English, Greek"
              className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            />
            <p className="mt-1 text-xs text-slate-500">
              Separate with commas or semicolons.
            </p>
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
          Used in appointment confirmation emails to enable "Chat on WhatsApp".
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Working days
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Select the days you see patients.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          {days.map(({ label, value, set }) => (
            <label
              key={label}
              className="flex cursor-pointer items-center gap-2"
            >
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => set(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400/60"
              />
              <span className="text-sm text-slate-200">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
          <label
            htmlFor="startTime"
            className="text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            Start time
          </label>
          <input
            id="startTime"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
          />
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
          <label
            htmlFor="endTime"
            className="text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            End time
          </label>
          <input
            id="endTime"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
          />
        </div>
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
