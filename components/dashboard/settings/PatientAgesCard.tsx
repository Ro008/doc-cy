"use client";

import * as React from "react";
import { toast } from "sonner";
import { SavingNote } from "@/components/dashboard/settings/BusyLabel";
import { SETTINGS_CARD_CLASS } from "@/components/dashboard/settings/styles";
import { PATIENT_AGE_OPTIONS, type PatientAges } from "@/lib/settings-profile-details";

/**
 * "Who you see" on the Profile tab (user, 2026-10-10): adults, children or both, so a
 * parent knows before booking. One choice, saved the moment it is picked: no founder,
 * each change recorded (PUT /api/professional-profile { patientAges }).
 */
export function PatientAgesCard({ initialValue = null }: { initialValue?: PatientAges | null }) {
  const [value, setValue] = React.useState<PatientAges | null>(initialValue);
  const [saving, setSaving] = React.useState(false);

  async function pick(next: PatientAges) {
    if (next === value || saving) return;
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch("/api/professional-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientAges: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Saved. Your profile now says who you see.", { id: "patient-ages" });
      } else {
        setValue(previous);
        toast.error(typeof data?.message === "string" ? data.message : "Could not save who you see.", {
          id: "patient-ages",
        });
      }
    } catch (err) {
      console.error(err);
      setValue(previous);
      toast.error("Could not save who you see.", { id: "patient-ages" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={SETTINGS_CARD_CLASS} data-testid="settings-patient-ages">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <p id="patient-ages-label" className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            Patients I see
            <SavingNote busy={saving} />
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Shown on your profile, so parents know whether you see children.
          </p>
        </div>
        <div role="radiogroup" aria-labelledby="patient-ages-label" className="flex flex-wrap gap-1.5">
          {PATIENT_AGE_OPTIONS.map((option) => {
            const selected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saving}
                onClick={() => void pick(option.value)}
                className={`h-9 whitespace-nowrap rounded-xl border px-3 text-sm font-medium transition active:scale-[0.98] disabled:cursor-progress ${
                  selected
                    ? "border-clinical-400/60 bg-clinical-500/15 text-clinical-50"
                    : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
