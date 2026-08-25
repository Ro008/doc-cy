"use client";

import { agendaClinicEventColor } from "@/lib/doctor-locations";
import type { AgendaClinic } from "@/lib/agenda-clinics";

type Props = {
  clinics: readonly AgendaClinic[];
  hiddenIds: ReadonlySet<string>;
  onToggle: (clinicId: string) => void;
};

function formatClinicList(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function agendaClinicVisibilityMessage(
  clinics: readonly Pick<AgendaClinic, "id" | "name">[],
  hiddenIds: ReadonlySet<string>,
): { tone: "empty" | "active"; text: string } | null {
  if (clinics.length <= 1) return null;
  const visible = clinics.filter((clinic) => !hiddenIds.has(clinic.id));
  if (visible.length === 0) {
    return {
      tone: "empty",
      text: "No calendars selected. Turn one on to see appointments.",
    };
  }
  const names = visible.map((clinic) => clinic.name);
  const clinicWord = names.length === 1 ? "clinic" : "clinics";
  return {
    tone: "active",
    text: `You're viewing appointments for your ${clinicWord} ${formatClinicList(names)}.`,
  };
}

export function AgendaClinicCalendars({ clinics, hiddenIds, onToggle }: Props) {
  if (clinics.length <= 1) return null;

  const status = agendaClinicVisibilityMessage(clinics, hiddenIds);

  return (
    <div className="mt-2 space-y-2" data-testid="agenda-clinic-calendars">
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Calendars"
      >
        <p className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Calendars
        </p>
        {clinics.map((clinic, index) => {
          const visible = !hiddenIds.has(clinic.id);
          const color = agendaClinicEventColor(index);
          return (
            <button
              key={clinic.id}
              type="button"
              aria-pressed={visible}
              title={visible ? `Hide ${clinic.name}` : `Show ${clinic.name}`}
              onClick={() => onToggle(clinic.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition ${
                visible
                  ? "border-slate-500 bg-slate-800/90 text-slate-100"
                  : "border-slate-700 bg-transparent text-slate-500"
              }`}
            >
              <span
                className={`h-3.5 w-3.5 shrink-0 rounded-[3px] ${
                  visible ? color.swatch : `border-2 bg-transparent ${color.empty}`
                }`}
                aria-hidden
              />
              {clinic.name}
            </button>
          );
        })}
      </div>

      {status ? (
        <p
          role="status"
          data-testid="agenda-clinic-visibility"
          className={`rounded-lg border px-3 py-2 text-sm font-semibold leading-snug ${
            status.tone === "empty"
              ? "border-amber-400/55 bg-amber-500/20 text-amber-50"
              : "border-clinical-400/45 bg-clinical-500/15 text-clinical-50"
          }`}
        >
          {status.text}
        </p>
      ) : null}
    </div>
  );
}
