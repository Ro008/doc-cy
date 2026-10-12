"use client";

import * as React from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { enGB } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, MapPin, PencilLine, Search, Stethoscope, X } from "lucide-react";
import "react-day-picker/dist/style.css";
import { PillSelect } from "@/components/visits/PillSelect";
import {
  activeRangePreset,
  dateToDayKey,
  dayKeyToDate,
  rangeLabel,
  rangePresets,
} from "@/lib/past-visits-range";
import type { PastVisitsAttendance } from "@/lib/past-visits";

const ATTENDANCE: { value: PastVisitsAttendance; label: string }[] = [
  { value: "all", label: "All" },
  { value: "attended", label: "Attended" },
  { value: "no_show", label: "No-shows" },
];

const PILL =
  "inline-flex h-10 items-center gap-2 rounded-full border border-slate-700/80 bg-ink-900/70 px-3.5 text-sm text-slate-200 transition hover:border-clinical-500/50 hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/50";

/**
 * The Visits tab's search panel (user, 2026-10-12). Still a plain GET form (the URL carries the
 * filters), now with a branded date-range calendar with shortcuts, a segmented attendance
 * control and pill selects. Changing a filter other than the text searches right away.
 */
export function VisitsFilters({
  action,
  q,
  from,
  to,
  attendance,
  service,
  clinicId,
  notes,
  patientId,
  missingNotesCount,
  serviceNames,
  clinics,
  todayKey,
  filtered,
}: {
  action: string;
  q: string;
  from: string | null;
  to: string | null;
  attendance: PastVisitsAttendance;
  service: string | null;
  clinicId: string | null;
  notes: "all" | "missing";
  /** Keeps the patient filter while she searches within it. */
  patientId: string | null;
  /** All her past visits without notes, whatever the filters. */
  missingNotesCount: number;
  serviceNames: string[];
  clinics: { clinicId: string; name: string; swatch: string }[];
  /** Today in Cyprus, YYYY-MM-DD. */
  todayKey: string;
  filtered: boolean;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState<{ from: string | null; to: string | null }>({ from, to });
  const [draft, setDraft] = React.useState<DateRange | undefined>(undefined);
  const [att, setAtt] = React.useState<PastVisitsAttendance>(attendance);
  const submitNext = React.useRef(false);
  const today = React.useMemo(() => dayKeyToDate(todayKey), [todayKey]);

  const submit = React.useCallback(() => formRef.current?.requestSubmit(), []);

  // The hidden from/to inputs update on render; search once they have.
  React.useEffect(() => {
    if (submitNext.current) {
      submitNext.current = false;
      submit();
    }
  }, [range, att, submit]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openPicker() {
    setDraft(range.from ? { from: dayKeyToDate(range.from), to: range.to ? dayKeyToDate(range.to) : undefined } : undefined);
    setOpen((v) => !v);
  }

  function applyRange(next: { from: string | null; to: string | null }) {
    submitNext.current = true;
    setRange(next);
    setOpen(false);
  }

  const draftFrom = draft?.from ? dateToDayKey(draft.from) : null;
  const draftTo = draft?.to ? dateToDayKey(draft.to) : draftFrom;
  const activePreset = activeRangePreset(draftFrom, draftTo, todayKey);
  const hasRange = Boolean(range.from || range.to);

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      role="search"
      aria-label="Search visits"
      data-testid="past-visits-search"
      className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-ink-900/70 p-4 shadow-xl shadow-black/20 sm:p-5"
    >
      <input type="hidden" name="from" value={range.from ?? ""} />
      <input type="hidden" name="to" value={range.to ?? ""} />
      {patientId ? <input type="hidden" name="patient" value={patientId} /> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="visits-q" className="sr-only">
            Search
          </label>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            id="visits-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={100}
            placeholder="Patient name, email or phone, reason, service or notes"
            className="h-12 w-full rounded-2xl border border-slate-700/80 bg-ink-900/70 pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-clinical-500/60 focus:outline-none focus:ring-2 focus:ring-clinical-500/30"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-clinical-500 px-6 text-sm font-semibold text-white shadow-md shadow-clinical-500/25 transition hover:bg-clinical-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
        >
          Search
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative" ref={popRef}>
          <button
            type="button"
            onClick={openPicker}
            aria-expanded={open}
            aria-haspopup="dialog"
            data-testid="visits-range-trigger"
            className={`${PILL} ${hasRange ? "border-clinical-500/60 bg-clinical-500/10 text-clinical-100" : ""}`}
          >
            <CalendarDays aria-hidden className={`h-4 w-4 ${hasRange ? "text-clinical-300" : "text-slate-500"}`} />
            <span>{rangeLabel(range.from, range.to)}</span>
            <ChevronDown aria-hidden className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open ? (
            <div
              role="dialog"
              aria-label="Choose a date range"
              data-testid="visits-range-popover"
              className="absolute left-0 z-30 mt-2 w-[min(21rem,calc(100vw-2.5rem))] rounded-2xl border border-white/10 bg-ink-900 p-4 shadow-2xl shadow-black/50"
            >
              <div className="mb-3 flex flex-wrap gap-1.5">
                {rangePresets(todayKey).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyRange({ from: p.from, to: p.to })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      activePreset === p.id
                        ? "border-clinical-400 bg-clinical-500/20 text-clinical-100"
                        : "border-slate-700 text-slate-300 hover:border-clinical-500/50 hover:text-clinical-100"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <DayPicker
                mode="range"
                selected={draft}
                onSelect={setDraft}
                defaultMonth={draft?.from ?? today}
                toDate={today}
                weekStartsOn={1}
                locale={enGB}
                className="rdp-brand"
                classNames={{
                  root: "p-0",
                  caption: "mb-3 flex items-center justify-between",
                  caption_label: "text-sm",
                  nav: "flex gap-1",
                  nav_button: "h-8 w-8 p-0",
                  month: "w-full",
                  table: "w-full border-collapse",
                  day: "h-[38px] w-[38px] p-0 text-sm",
                }}
                components={{
                  IconLeft: () => <ChevronLeft className="mx-auto h-4 w-4" />,
                  IconRight: () => <ChevronRight className="mx-auto h-4 w-4" />,
                }}
              />

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => applyRange({ from: null, to: null })}
                  className="text-xs font-medium text-slate-400 transition hover:text-slate-200"
                >
                  Any date
                </button>
                <button
                  type="button"
                  disabled={!draftFrom}
                  onClick={() => applyRange({ from: draftFrom, to: draftTo })}
                  className="inline-flex h-9 items-center rounded-xl bg-clinical-500 px-4 text-sm font-semibold text-white transition hover:bg-clinical-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <fieldset className="inline-flex h-10 items-center rounded-full border border-slate-700/80 bg-ink-900/70 p-1">
          <legend className="sr-only">Attendance</legend>
          {ATTENDANCE.map((o) => (
            <label key={o.value} className="cursor-pointer">
              <input
                type="radio"
                name="attendance"
                value={o.value}
                checked={att === o.value}
                onChange={() => {
                  submitNext.current = true;
                  setAtt(o.value);
                }}
                className="peer sr-only"
              />
              <span className="inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-slate-400 transition peer-checked:bg-clinical-500 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-clinical-300 hover:text-slate-200 peer-checked:hover:text-white">
                {o.label}
              </span>
            </label>
          ))}
        </fieldset>

        {missingNotesCount > 0 || notes === "missing" ? (
          <label className="cursor-pointer">
            <input
              type="checkbox"
              name="notes"
              value="missing"
              defaultChecked={notes === "missing"}
              onChange={submit}
              data-testid="visits-missing-notes"
              className="peer sr-only"
            />
            <span
              className={`${PILL} peer-checked:border-clinical-500/60 peer-checked:bg-clinical-500/10 peer-checked:text-clinical-100 peer-focus-visible:ring-2 peer-focus-visible:ring-clinical-500/50`}
            >
              <PencilLine aria-hidden className="h-4 w-4 text-slate-500" />
              Without notes
              <span className="rounded-full bg-clinical-500/20 px-1.5 text-xs font-semibold text-clinical-200">
                {missingNotesCount}
              </span>
            </span>
          </label>
        ) : null}

        {serviceNames.length > 0 ? (
          <PillSelect
            id="visits-service"
            name="service"
            label="Service"
            icon={<Stethoscope className="h-4 w-4" />}
            value={service ?? ""}
            allLabel="All services"
            options={serviceNames.map((n) => ({ value: n, label: n }))}
            onChange={submit}
          />
        ) : null}

        {clinics.length > 1 ? (
          <PillSelect
            id="visits-clinic"
            name="clinic"
            label="Clinic"
            icon={<MapPin className="h-4 w-4" />}
            value={clinicId ?? ""}
            allLabel="All clinics"
            options={clinics.map((c) => ({ value: c.clinicId, label: c.name, swatch: c.swatch }))}
            onChange={submit}
          />
        ) : null}

        {filtered ? (
          <a
            href={action}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm text-slate-400 transition hover:text-slate-100"
          >
            <X aria-hidden className="h-4 w-4" />
            Clear filters
          </a>
        ) : null}
      </div>
    </form>
  );
}
