"use client";

import { SpecialtyCombobox } from "@/components/specialties/SpecialtyCombobox";

export function RegisterSpecialtyFields() {
  return (
    <div className="group sm:col-span-2" data-validate-field="1" data-invalid="0">
      <p className="block text-sm font-medium text-slate-200">
        Specialty
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Choose from the standard list, or pick &quot;Other&quot; if yours isn&apos;t listed (we&apos;ll
        review it).
      </p>
      <SpecialtyCombobox
        id="register-specialty"
        initialSpecialty=""
        initialIsApproved={true}
        variant="register"
      />
      <p className="field-hint mt-1 hidden text-xs text-red-300 group-data-[invalid=1]:block">
        Please select your specialty.
      </p>
    </div>
  );
}
