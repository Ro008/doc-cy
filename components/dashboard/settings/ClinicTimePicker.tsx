"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import {
  CLINIC_TIME_MINUTES,
  clinicHourAllowed,
  clinicHourIsUsual,
  clinicTimeAllowed,
  clinicTimeWithHour,
  clinicTimeWithMinute,
} from "@/lib/clinic-hours-check";

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));

const CHOICE_CLASS =
  "rounded-lg border text-sm tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/60 disabled:cursor-not-allowed disabled:border-transparent disabled:text-slate-700";
const CHOICE_ON = "border-clinical-400/60 bg-clinical-500/15 font-semibold text-clinical-50";
const CHOICE_OFF = "border-transparent text-slate-200 hover:border-slate-600 hover:bg-white/5";
/** An hour outside the usual working day: quieter, still on offer. */
const CHOICE_UNUSUAL = "border-transparent text-slate-500 hover:border-slate-600 hover:bg-white/5 hover:text-slate-300";

/**
 * A time of day in a clinic's hours (user, 2026-10-10): the hour from a small grid, the
 * minutes from the four quarters, so there is no 17:02 and no list of 96 times. Picking
 * the minutes closes it; Escape or a click outside too. Hours a clinic rarely works are
 * dimmed, not blocked. `after` greys out what is not
 * later than it (an end time after its start); `before`, what is not earlier (a break
 * before the day ends).
 */
export function ClinicTimePicker({
  label,
  value,
  onChange,
  after,
  before,
  invalid = false,
  describedBy,
  align = "left",
  variant = "field",
}: {
  /** What the time is ("Monday end time"): the button's and the picker's name. */
  label: string;
  /** "HH:MM". */
  value: string;
  onChange: (time: string) => void;
  /** Only times after this one are on offer. */
  after?: string | null;
  /** Only times before this one are on offer (a break before the day ends). */
  before?: string | null;
  invalid?: boolean;
  describedBy?: string;
  /** Which edge of the button the picker hangs from. */
  align?: "left" | "right";
  /** "field" is a box of its own; "inline" is bare text, for a time inside a group (a break). */
  variant?: "field" | "inline";
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const [hour, minute] = value.split(":");

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onClick={() => setOpen((was) => !was)}
        className={
          variant === "inline"
            ? `rounded-lg px-2 py-1 text-sm tabular-nums transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/60 ${
                invalid ? "text-red-200" : open ? "bg-white/10 text-clinical-50" : "text-slate-100"
              }`
            : `flex w-28 items-center justify-between gap-2 rounded-xl border bg-slate-950/60 px-3 py-2 text-sm tabular-nums text-slate-100 transition hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/60 ${
                invalid ? "border-red-400/70" : open ? "border-clinical-400/60" : "border-slate-700"
              }`
        }
      >
        {value}
        {variant === "field" ? (
          <Clock className={`h-3.5 w-3.5 ${open ? "text-clinical-300" : "text-slate-500"}`} aria-hidden />
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute top-full z-50 mt-1.5 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Hour
          </p>
          <div role="radiogroup" aria-label="Hour" className="mt-1.5 grid grid-cols-6 gap-1">
            {HOURS.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={choice === hour}
                disabled={!clinicHourAllowed(choice, after, before)}
                onClick={() => onChange(clinicTimeWithHour(value, choice, after, before))}
                title={clinicHourIsUsual(choice) ? undefined : "Outside the usual working hours"}
                className={`${CHOICE_CLASS} h-8 ${
                  choice === hour ? CHOICE_ON : clinicHourIsUsual(choice) ? CHOICE_OFF : CHOICE_UNUSUAL
                }`}
              >
                {choice}
              </button>
            ))}
          </div>

          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Minutes</p>
          <div role="radiogroup" aria-label="Minutes" className="mt-1.5 grid grid-cols-4 gap-1">
            {CLINIC_TIME_MINUTES.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-label={choice}
                aria-checked={choice === minute}
                disabled={!clinicTimeAllowed(`${hour}:${choice}`, after, before)}
                onClick={() => {
                  onChange(clinicTimeWithMinute(value, choice));
                  close();
                }}
                className={`${CHOICE_CLASS} h-9 ${
                  choice === minute ? CHOICE_ON : "border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-white/5"
                }`}
              >
                :{choice}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
