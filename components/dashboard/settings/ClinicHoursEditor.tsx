"use client";

import * as React from "react";
import { Coffee, Copy, Plus, X } from "lucide-react";
import { ClinicTimePicker } from "@/components/dashboard/settings/ClinicTimePicker";
import { SETTINGS_EYEBROW_CLASS } from "@/components/dashboard/settings/styles";
import { defaultDayBreak, type ClinicHoursProblems } from "@/lib/clinic-hours-check";
import { DAY_NAMES, type DayKey, type DayScheduleEntry, type WeeklySchedule } from "@/lib/doctor-settings";

const DAY_LABELS: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const hhmm = (time: string | null | undefined, fallback: string) => {
  const [hours, minutes] = String(time ?? "").split(":");
  return hours && minutes ? `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}` : fallback;
};

const ICON_BUTTON_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/60 active:scale-95";

/**
 * A clinic's week in the hours editor (user, 2026-10-10): one row per day with its
 * hours and its own break, since a break that suits a long day can fall outside a short
 * one. "Add break" starts from lunch when it fits; the copy button puts a day's hours
 * and break on the other open days, so the usual week is still set in one go. What is
 * wrong with a day is said under its row (lib/clinic-hours-check.ts).
 */
export function ClinicHoursEditor({
  schedule,
  onChange,
  problems,
}: {
  schedule: WeeklySchedule;
  onChange: (update: (previous: WeeklySchedule) => WeeklySchedule) => void;
  problems: ClinicHoursProblems;
}) {
  const setDay = (day: DayKey, patch: Partial<DayScheduleEntry>) =>
    onChange((previous) => ({ ...previous, [day]: { ...previous[day], ...patch } }));

  const openDays = DAY_NAMES.filter((day) => schedule[day].enabled);

  const copyToOpenDays = (from: DayKey) =>
    onChange((previous) => {
      const { start_time, end_time, break_start = null, break_end = null } = previous[from];
      const next = { ...previous };
      for (const day of DAY_NAMES) {
        if (day !== from && previous[day].enabled) {
          next[day] = { ...previous[day], start_time, end_time, break_start, break_end };
        }
      }
      return next;
    });

  return (
    <div>
      <div className="hidden items-center gap-x-4 sm:flex">
        <p className={`${SETTINGS_EYEBROW_CLASS} w-36`}>Working hours</p>
        <p className={`${SETTINGS_EYEBROW_CLASS} w-[15.5rem]`}>Open</p>
        <p className={SETTINGS_EYEBROW_CLASS}>Break</p>
      </div>
      <p className={`${SETTINGS_EYEBROW_CLASS} sm:hidden`}>Working hours</p>

      <div className="mt-2 divide-y divide-slate-800">
        {DAY_NAMES.map((day) => {
          const entry = schedule[day];
          const label = DAY_LABELS[day];
          const problem = entry.enabled ? problems.days[day] : undefined;
          const problemId = `${day}-hours-problem`;
          const breakProblem = Boolean(problem?.includes("break"));
          const start = hhmm(entry.start_time, "09:00");
          const end = hhmm(entry.end_time, "17:00");
          const hasBreak = Boolean(entry.break_start && entry.break_end);
          const suggestion = defaultDayBreak(start, end);

          return (
            <div key={day} className="py-2.5" data-testid={`settings-clinic-day-${day}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="order-1 flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 sm:w-36 sm:flex-none">
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={(event) => setDay(day, { enabled: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-clinical-500 focus:ring-clinical-400/60"
                  />
                  <span className={`text-sm ${entry.enabled ? "text-slate-100" : "text-slate-500"}`}>{label}</span>
                </label>

                {entry.enabled ? (
                  <>
                    <div className="order-3 flex w-full items-center gap-2 text-sm text-slate-400 sm:order-2 sm:w-auto">
                      <ClinicTimePicker
                        label={`${label} start time`}
                        value={start}
                        onChange={(time) => setDay(day, { start_time: `${time}:00` })}
                      />
                      <span aria-hidden>–</span>
                      <ClinicTimePicker
                        label={`${label} end time`}
                        value={end}
                        after={start}
                        invalid={Boolean(problem) && !breakProblem}
                        describedBy={problem ? problemId : undefined}
                        align="right"
                        onChange={(time) => setDay(day, { end_time: `${time}:00` })}
                      />
                    </div>

                    <div className="order-4 flex w-full items-center gap-2 text-sm text-slate-400 sm:order-3 sm:w-auto sm:min-w-0 sm:flex-1">
                      {hasBreak ? (
                        // One warm capsule, not two boxes: a pause in the day, told apart from its hours.
                        <div
                          className={`inline-flex h-[2.375rem] items-center gap-0.5 rounded-full border pl-3 pr-1 ${
                            breakProblem ? "border-red-400/70 bg-red-400/5" : "border-amber-300/20 bg-amber-300/[0.06]"
                          }`}
                        >
                          <Coffee className="mr-1 h-4 w-4 shrink-0 text-amber-200/70" aria-hidden />
                          <ClinicTimePicker
                            variant="inline"
                            label={`${label} break start`}
                            value={hhmm(entry.break_start, "13:00")}
                            after={start}
                            before={end}
                            invalid={breakProblem}
                            describedBy={breakProblem ? problemId : undefined}
                            onChange={(time) => setDay(day, { break_start: `${time}:00` })}
                          />
                          <span aria-hidden>–</span>
                          <ClinicTimePicker
                            variant="inline"
                            label={`${label} break end`}
                            value={hhmm(entry.break_end, "14:00")}
                            after={hhmm(entry.break_start, start)}
                            before={end}
                            invalid={breakProblem}
                            describedBy={breakProblem ? problemId : undefined}
                            align="right"
                            onChange={(time) => setDay(day, { break_end: `${time}:00` })}
                          />
                          <button
                            type="button"
                            aria-label={`Remove ${label}'s break`}
                            title="Remove the break"
                            onClick={() => setDay(day, { break_start: null, break_end: null })}
                            className={`${ICON_BUTTON_CLASS} !h-7 !w-7 !rounded-full`}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Add a break on ${label}`}
                          disabled={!suggestion}
                          title={suggestion ? undefined : "This day is too short for a break"}
                          onClick={() =>
                            suggestion &&
                            setDay(day, { break_start: `${suggestion.start}:00`, break_end: `${suggestion.end}:00` })
                          }
                          className="inline-flex h-[2.375rem] items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-slate-700 px-3 text-sm text-slate-400 transition hover:border-slate-500 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          Add break
                        </button>
                      )}

                    </div>
                    {openDays.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Copy ${label}'s hours and break to the other open days`}
                        title="Copy to the other open days"
                        onClick={() => copyToOpenDays(day)}
                        className={`${ICON_BUTTON_CLASS} order-2 sm:order-4`}
                      >
                        <Copy className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                  </>
                ) : (
                  <span className="order-2 text-sm text-slate-500">Closed</span>
                )}
              </div>

              {problem ? (
                <p id={problemId} role="alert" className="mt-1.5 text-xs font-medium text-red-300 sm:pl-40">
                  {problem}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Patients cannot book during a break. Each day can have its own, or none.
      </p>
    </div>
  );
}
