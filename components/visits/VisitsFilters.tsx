"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DayPicker, type DateRange } from "react-day-picker";
import { enGB } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, MapPin, PencilLine, Search, Stethoscope, X } from "lucide-react";
import "react-day-picker/dist/style.css";
import { PillSelect } from "@/components/visits/PillSelect";
import { resetMissingNotesChanges, useMissingNotesChange } from "@/components/visits/missing-notes-count";
import { leaveVisits } from "@/components/visits/unsaved-notes";
import { VisitsLink, pushVisitsHref } from "@/components/visits/VisitsLink";
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
  "inline-flex h-10 items-center gap-2 rounded-full border border-pro-line/80 bg-pro-page/70 px-3.5 text-sm text-slate-200 transition hover:border-clinical-500/50 hover:bg-pro-page focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/50";

/**
 * The Visits tab's search panel (user, 2026-10-12). A GET form (the URL carries the filters)
 * with a branded date-range calendar with shortcuts, a segmented attendance control and pill
 * selects. Changing a filter other than the text searches right away.
 *
 * Submitting moves to the new URL inside the app instead of loading the document again
 * (user, 2026-10-13): a full load redraws the top bar with no tab selected for a moment. The
 * page gives this form a `key` from the URL, so it starts again from the new filters.
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
  loadedAt,
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
  /** When the server counted it: a new load drops the changes made on the page since the last. */
  loadedAt: number;
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

  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const submit = React.useCallback(() => formRef.current?.requestSubmit(), []);

  // The server's count, moved by the notes she saved or cleared on the page since.
  const missingChange = useMissingNotesChange();
  React.useEffect(() => resetMissingNotesChanges(), [loadedAt]);
  const missingNotes = Math.max(0, missingNotesCount + missingChange);

  // She chose to keep editing her unsaved notes: the filters go back to what the list shows.
  const [resetKey, setResetKey] = React.useState(0);
  function restoreFilters() {
    setAtt(attendance);
    setRange({ from, to });
    setResetKey((k) => k + 1);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(e.currentTarget)) {
      const text = typeof value === "string" ? value.trim() : "";
      if (text && !(name === "attendance" && text === "all")) params.set(name, text);
    }
    const qs = params.toString();
    // With notes typed and not saved, she is asked first (components/visits/unsaved-notes).
    leaveVisits(
      () => startTransition(() => pushVisitsHref(router, qs ? `${action}?${qs}` : action)),
      restoreFilters,
    );
  }

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
      onSubmit={onSubmit}
      role="search"
      aria-label="Search visits"
      aria-busy={pending}
      data-testid="past-visits-search"
      className="peer relative rounded-3xl border border-pro-line/70 bg-pro-card p-4 shadow-xl shadow-black/20 sm:p-5"
    >
      {/* While the results load: a light sliding along the panel's lower edge; the page dims the
          old results through `peer-aria-busy` (user, 2026-10-13). */}
      {pending ? (
        <span
          aria-hidden
          data-testid="visits-loading-bar"
          className="pointer-events-none absolute inset-x-6 bottom-0 h-0.5 overflow-hidden rounded-full"
        >
          <span className="visits-loading-slide absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-clinical-400 to-transparent" />
        </span>
      ) : null}
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
            className="h-12 w-full rounded-2xl border border-pro-line/80 bg-pro-page/70 pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-clinical-500/60 focus:outline-none focus:ring-2 focus:ring-clinical-500/30"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-clinical-500 px-6 text-sm font-semibold text-white shadow-md shadow-clinical-500/25 transition hover:bg-clinical-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-300 focus-visible:ring-offset-2 focus-visible:ring-offset-pro-page"
        >
          Search
        </button>
      </div>

      <div key={resetKey} className="mt-3 flex flex-wrap items-center gap-2">
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
              className="absolute left-0 z-30 mt-2 w-[min(21rem,calc(100vw-2.5rem))] rounded-2xl border border-pro-line bg-pro-card p-4 shadow-2xl shadow-black/50"
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
                        : "border-pro-line text-slate-300 hover:border-clinical-500/50 hover:text-clinical-100"
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

        <fieldset className="inline-flex h-10 items-stretch overflow-hidden rounded-full border border-pro-line/80 bg-pro-page/70">
          <legend className="sr-only">Attendance</legend>
          {ATTENDANCE.map((o) => (
            <label key={o.value} className="flex cursor-pointer">
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
              <span className="inline-flex items-center px-3.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white peer-checked:bg-clinical-500/20 peer-checked:text-clinical-200 peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-clinical-400/70">
                {o.label}
              </span>
            </label>
          ))}
        </fieldset>

        {missingNotes > 0 || notes === "missing" ? (
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
              <span
                data-testid="visits-missing-notes-count"
                className="rounded-full bg-clinical-500/20 px-1.5 text-xs font-semibold text-clinical-200"
              >
                {missingNotes}
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
          <VisitsLink
            href={action}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm text-slate-400 transition hover:text-slate-100"
          >
            <X aria-hidden className="h-4 w-4" />
            Clear filters
          </VisitsLink>
        ) : null}
      </div>
    </form>
  );
}
