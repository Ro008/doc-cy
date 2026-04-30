"use client";

import * as React from "react";
import { LanguageMultiSelect } from "@/components/languages/LanguageMultiSelect";

export function RegisterLanguageFields() {
  const [langs, setLangs] = React.useState<string[]>([]);

  return (
    <div className="group sm:col-span-2" data-validate-field="1" data-invalid="0">
      <label className="block text-sm font-medium text-slate-200">
        Spoken languages
      </label>
      <LanguageMultiSelect
        id="register-languages"
        hiddenInputName="language"
        selected={langs}
        onSelectedChange={setLangs}
        variant="register"
      />
      <p className="field-hint mt-1 hidden text-xs text-red-300 group-data-[invalid=1]:block">
        Please select at least one spoken language.
      </p>
    </div>
  );
}
