"use client";

import * as React from "react";
import { GraduationCap, X } from "lucide-react";
import { toast } from "sonner";
import { BusyLabel, BusySpinner } from "@/components/dashboard/settings/BusyLabel";
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_EYEBROW_CLASS,
  SETTINGS_GHOST_BUTTON_CLASS,
  SETTINGS_LINK_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/settings/styles";
import {
  MAX_QUALIFICATIONS,
  parseSavedQualifications,
  validateQualification,
  type QualificationErrors,
  type SavedQualification,
} from "@/lib/settings-profile-details";


const INPUT_CLASS =
  "mt-1.5 w-full rounded-xl border bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:ring-2";
const INPUT_OK = "border-slate-700 focus:border-clinical-400/60 focus:ring-clinical-400/30";
const INPUT_BAD = "border-red-400/70 focus:border-red-400 focus:ring-red-400/25";

/** Most recent first; those without a year last, in the order they were added. */
const byYear = (a: SavedQualification, b: SavedQualification) => (b.year ?? -1) - (a.year ?? -1);

const EMPTY = { title: "", institution: "", year: "" };

/**
 * Qualifications on the Profile tab (user, 2026-10-10): a short list of degrees and
 * training, shown on the public profile most recent first. Each line is added or removed
 * on its own.
 * No founder; each change is recorded. POST /api/professional-qualifications
 * { title, institution, year } → { qualification: { id, ... } };
 * DELETE /api/professional-qualifications?id=…
 */
export function QualificationsCard({ initial = [] }: { initial?: SavedQualification[] }) {
  const baseId = React.useId();
  const [items, setItems] = React.useState<SavedQualification[]>(() => [...initial].sort(byYear));
  const [adding, setAdding] = React.useState(false);
  const [typed, setTyped] = React.useState(EMPTY);
  const [errors, setErrors] = React.useState<QualificationErrors>({});
  const [busy, setBusy] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const full = items.length >= MAX_QUALIFICATIONS;

  const set = (field: keyof typeof EMPTY, value: string) => {
    setTyped((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const close = () => {
    setAdding(false);
    setTyped(EMPTY);
    setErrors({});
  };

  async function add() {
    const check = validateQualification(typed);
    if (check.ok === false) {
      setErrors(check.errors);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/professional-qualifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(check.qualification),
      });
      const data = await res.json().catch(() => ({}));
      const [saved] = parseSavedQualifications([data?.qualification]);
      if (!res.ok || !saved) {
        if (data?.errors && typeof data.errors === "object") setErrors(data.errors as QualificationErrors);
        toast.error(typeof data?.message === "string" ? data.message : "Could not add the qualification.");
        return;
      }
      setItems((previous) => [...previous, saved].sort(byYear));
      close();
      toast.success("Qualification added to your profile.", { id: "qualifications" });
    } catch (err) {
      console.error(err);
      toast.error("Could not add the qualification.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: SavedQualification) {
    setRemovingId(item.id);
    try {
      const res = await fetch(`/api/professional-qualifications?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      // 404: it is already gone from her profile, so it leaves the list here too.
      if (!res.ok && res.status !== 404) {
        toast.error(typeof data?.message === "string" ? data.message : "Could not remove the qualification.");
        return;
      }
      setItems((previous) => previous.filter((row) => row.id !== item.id));
      toast.success("Qualification removed.", { id: "qualifications" });
    } catch (err) {
      console.error(err);
      toast.error("Could not remove the qualification.");
    } finally {
      setRemovingId(null);
    }
  }

  const field = (
    name: keyof typeof EMPTY,
    label: string,
    placeholder: string,
    extra: { required?: boolean; className?: string; inputMode?: "numeric"; maxLength?: number } = {},
  ) => {
    const id = `${baseId}-${name}`;
    const error = errors[name];
    return (
      <div className={extra.className}>
        <label htmlFor={id} className="text-xs font-medium text-slate-300">
          {label}{" "}
          {extra.required ? (
            <span className="text-red-300">*</span>
          ) : (
            <span className="font-normal text-slate-500">(optional)</span>
          )}
        </label>
        <input
          id={id}
          type="text"
          inputMode={extra.inputMode}
          maxLength={extra.maxLength}
          autoComplete="off"
          value={typed[name]}
          onChange={(event) => set(name, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void add();
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          placeholder={placeholder}
          className={`${INPUT_CLASS} ${error ? INPUT_BAD : INPUT_OK}`}
        />
        {error ? (
          <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <section className={SETTINGS_CARD_CLASS} data-testid="settings-qualifications">
      <p className={SETTINGS_EYEBROW_CLASS}>Qualifications</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        Your degrees, specialty training and fellowships. Patients see them on your profile, most
        recent first.
      </p>

      {items.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-800">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60 text-clinical-300">
                <GraduationCap className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="truncate text-xs text-slate-400">
                  {item.institution}
                  {item.year ? ` · ${item.year}` : ""}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${item.title}`}
                disabled={removingId !== null}
                aria-busy={removingId === item.id}
                onClick={() => void remove(item)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/60 active:scale-95 disabled:opacity-50 aria-busy:cursor-progress aria-busy:opacity-100"
              >
                {removingId === item.id ? <BusySpinner /> : <X className="h-4 w-4" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      ) : adding ? null : (
        <p className="mt-3 text-sm text-slate-300">None yet.</p>
      )}

      {adding ? (
        // Not a <form>: the settings page is one already.
        <fieldset
          disabled={busy}
          data-testid="settings-qualification-form"
          className="mt-3 min-w-0 space-y-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-4"
        >
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
            {field("title", "Qualification", "For example: MD, Medicine", { required: true })}
            {field("year", "Year", "2012", { inputMode: "numeric", maxLength: 4 })}
          </div>
          {field("institution", "Where you obtained it", "For example: University of Athens", { required: true })}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void add()}
              disabled={busy}
              aria-busy={busy}
              className={SETTINGS_PRIMARY_BUTTON_CLASS}
            >
              <BusyLabel busy={busy} busyText="Adding…">
                Add qualification
              </BusyLabel>
            </button>
            <button type="button" disabled={busy} onClick={close} className={SETTINGS_GHOST_BUTTON_CLASS}>
              Cancel
            </button>
          </div>
        </fieldset>
      ) : full ? (
        <p className="mt-3 text-xs text-slate-400">
          You can list up to {MAX_QUALIFICATIONS}. Remove one to add another.
        </p>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`mt-3 ${SETTINGS_LINK_CLASS}`}>
          + Add a qualification
        </button>
      )}
    </section>
  );
}
