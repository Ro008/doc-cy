"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { SpecialtyCombobox } from "@/components/specialties/SpecialtyCombobox";
import {
  registerFieldErrorClass,
  registerHelperClass,
  registerInputClass,
  registerLabelClass,
} from "@/lib/register-ui";
import { MAX_DOCTOR_SPECIALTIES } from "@/lib/doctor-specialties";
import { hasDuplicateSpecialtyLabels } from "@/lib/specialty-options";

type RowState = {
  key: string;
  specialty: string;
  fromMaster: boolean;
  licenseNumber: string;
};

function newRow(index = 0): RowState {
  return {
    key: `spec-${index}`,
    specialty: "",
    fromMaster: true,
    licenseNumber: "",
  };
}

function specialtyKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Flat multi-specialty registration: each row is specialty + license (equal weight).
 */
export function RegisterSpecialtyFields({
  initialSpecialties,
}: {
  initialSpecialties?: readonly { specialty: string; fromMaster: boolean }[];
} = {}) {
  const [rows, setRows] = React.useState<RowState[]>(() => {
    if (initialSpecialties && initialSpecialties.length > 0) {
      return initialSpecialties.slice(0, MAX_DOCTOR_SPECIALTIES).map((entry, index) => ({
        ...newRow(index),
        specialty: entry.specialty,
        fromMaster: entry.fromMaster,
      }));
    }
    return [newRow(0)];
  });

  const payload = rows.map((r) => ({
    specialty: r.specialty,
    fromMaster: r.fromMaster,
    licenseNumber: r.licenseNumber,
  }));

  const hasDuplicates = hasDuplicateSpecialtyLabels(rows.map((r) => r.specialty));
  const allFilled =
    rows.length > 0 &&
    rows.every(
      (r) => r.specialty.trim().length > 0 && r.licenseNumber.trim().length > 0,
    );
  const formValid = allFilled && !hasDuplicates;

  return (
    <div
      className="group space-y-4"
      data-validate-field="1"
      data-invalid="0"
      data-field-key="specialties"
      data-field-label="Specialties and license numbers"
    >
      <div>
        <p className={registerLabelClass}>
          Specialties<span className="text-red-600">*</span>
        </p>
        <p className={registerHelperClass}>
          Add every specialty you practise. Each one needs its own license or
          certification number. Choose from the list, or select &quot;Other&quot; if
          yours isn&apos;t listed (our team will review it).
          {initialSpecialties && initialSpecialties.length > 0
            ? " We filled this from your listing — confirm or adjust it."
            : null}
        </p>
      </div>

      <input
        type="hidden"
        name="specialtiesJson"
        value={JSON.stringify(payload)}
        readOnly
      />
      {/* Keep legacy single fields for older parsers / smoke tests that peek at name=specialty */}
      <input type="hidden" name="specialty" value={rows[0]?.specialty ?? ""} readOnly />
      <input
        type="hidden"
        name="specialtyFromMaster"
        value={rows[0]?.fromMaster ? "1" : "0"}
        readOnly
      />
      <input
        type="hidden"
        name="licenseNumber"
        value={rows[0]?.licenseNumber ?? ""}
        readOnly
      />

      <input
        type="text"
        data-validity-proxy="true"
        required
        value={formValid ? "ok" : ""}
        // A readonly input is barred from constraint validation, which would make
        // this required field silently always valid. The no-op keeps React quiet.
        onChange={() => {}}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />

      <ul className="space-y-4">
        {rows.map((row, index) => {
          const key = specialtyKey(row.specialty);
          const isDuplicate =
            Boolean(key) &&
            rows.some(
              (other, otherIndex) =>
                otherIndex !== index && specialtyKey(other.specialty) === key,
            );
          const excluded = rows
            .filter((r) => r.key !== row.key)
            .map((r) => r.specialty)
            .filter(Boolean);

          return (
            <li
              key={row.key}
              className="rounded-2xl border border-ink-200 bg-white/70 p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Specialty {index + 1}
                </p>
                {rows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setRows((prev) => prev.filter((r) => r.key !== row.key))
                    }
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
                    aria-label={`Remove specialty ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Remove
                  </button>
                ) : null}
              </div>
            <SpecialtyCombobox
              id={
                index === 0
                  ? "register-specialty"
                  : `register-specialty-${index}`
              }
              specialtyName={`_unused_specialty_${row.key}`}
              fromMasterName={`_unused_from_master_${row.key}`}
              initialSpecialty={row.specialty}
              initialIsApproved={row.fromMaster}
              variant="register"
              excludeSpecialties={excluded}
              onSelectionChange={(p) => {
                setRows((prev) => {
                  let changed = false;
                  const next = prev.map((r) => {
                    if (r.key !== row.key) return r;
                    if (r.specialty === p.specialty && r.fromMaster === p.fromMaster) {
                      return r;
                    }
                    changed = true;
                    return { ...r, specialty: p.specialty, fromMaster: p.fromMaster };
                  });
                  return changed ? next : prev;
                });
              }}
            />
              {isDuplicate ? (
                <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                  This specialty is already selected. Choose a different one.
                </p>
              ) : null}
              <label className={`${registerLabelClass} mt-3`}>
                License / certification number for this specialty
                <span className="text-red-600">*</span>
                <input
                  type="text"
                  value={row.licenseNumber}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRows((prev) =>
                      prev.map((r) =>
                        r.key === row.key ? { ...r, licenseNumber: value } : r,
                      ),
                    );
                  }}
                  autoComplete="off"
                  data-testid={`register-license-${index}`}
                  className={registerInputClass}
                  placeholder="Registration or certification number"
                />
              </label>
            </li>
          );
        })}
      </ul>

      {rows.length < MAX_DOCTOR_SPECIALTIES ? (
        <button
          type="button"
          onClick={() =>
            setRows((prev) => {
              const maxIndex = prev.reduce((n, r) => {
                const match = /^spec-(\d+)$/.exec(r.key);
                return match ? Math.max(n, Number(match[1])) : n;
              }, -1);
              return [...prev, newRow(maxIndex + 1)];
            })
          }
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-ink-300 bg-ink-50/80 px-3 py-2 text-sm font-semibold text-ink-700 transition hover:border-clinical-400 hover:bg-clinical-50 hover:text-clinical-800"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add another specialty
        </button>
      ) : (
        <p className={registerHelperClass}>
          Maximum of {MAX_DOCTOR_SPECIALTIES} specialties.
        </p>
      )}

      <p className={registerFieldErrorClass}>
        {hasDuplicates
          ? "Each specialty can only be added once."
          : "Please add at least one specialty with its license number."}
      </p>
    </div>
  );
}
