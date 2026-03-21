"use client";

import { SpecialtyCombobox } from "@/components/specialties/SpecialtyCombobox";

export function RegisterSpecialtyFields() {
  return (
    <div className="sm:col-span-2">
      <p className="block text-sm font-medium text-slate-200">
        Specialty <span className="text-red-300">*</span>
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
    </div>
  );
}
