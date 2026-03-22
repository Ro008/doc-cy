"use client";

import * as React from "react";
import { LanguageMultiSelect } from "@/components/languages/LanguageMultiSelect";

export function RegisterLanguageFields() {
  const [langs, setLangs] = React.useState<string[]>([]);

  return (
    <div className="sm:col-span-2">
      <label className="block text-sm font-medium text-slate-200">
        Spoken languages <span className="text-red-300">*</span>
      </label>
      <LanguageMultiSelect
        id="register-languages"
        hiddenInputName="language"
        selected={langs}
        onSelectedChange={setLangs}
        variant="register"
        requiredHint
      />
    </div>
  );
}
