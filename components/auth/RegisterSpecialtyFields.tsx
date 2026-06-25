"use client";

import { SpecialtyCombobox } from "@/components/specialties/SpecialtyCombobox";
import { registerFieldErrorClass, registerHelperClass, registerLabelClass } from "@/lib/register-ui";

export function RegisterSpecialtyFields() {
  return (
    <div className="group sm:col-span-2" data-validate-field="1" data-invalid="0">
      <p className={registerLabelClass}>
        Medical or Wellness Specialty<span className="text-red-600">*</span>
      </p>
      <p className={registerHelperClass}>
        Choose from the list, or select &quot;Other&quot; if yours isn&apos;t listed (our team will
        review it).
      </p>
      <SpecialtyCombobox
        id="register-specialty"
        initialSpecialty=""
        initialIsApproved={true}
        variant="register"
      />
      <p className={registerFieldErrorClass}>Please select your specialty.</p>
    </div>
  );
}
