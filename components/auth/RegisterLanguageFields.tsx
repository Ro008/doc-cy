"use client";

import * as React from "react";
import { LanguageMultiSelect } from "@/components/languages/LanguageMultiSelect";
import { registerFieldErrorClass, registerHelperClass, registerLabelClass } from "@/lib/register-ui";

export function RegisterLanguageFields() {
  const [langs, setLangs] = React.useState<string[]>([]);

  return (
    <div className="group sm:col-span-2" data-validate-field="1" data-invalid="0">
      <label className={registerLabelClass}>
        Languages Spoken in Consultation<span className="text-red-600">*</span>
      </label>
      <p className={registerHelperClass}>
        Select all languages you consult in. Patients filter by language to find you.
      </p>
      <LanguageMultiSelect
        id="register-languages"
        hiddenInputName="language"
        selected={langs}
        onSelectedChange={setLangs}
        variant="register"
      />
      <p className={registerFieldErrorClass}>Please select at least one spoken language.</p>
    </div>
  );
}
