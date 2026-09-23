"use client";

import * as React from "react";

export type RegisterWizardContextValue = {
  step: number;
  stepCount: number;
  setStep: (step: number) => void;
  goNext: () => void;
  submitLabel: string;
  /** One-line recap per finished step, keyed by step number. */
  summaries: Readonly<Record<number, string>>;
};

export const RegisterWizardContext =
  React.createContext<RegisterWizardContextValue | null>(null);

export function useRegisterWizard(): RegisterWizardContextValue | null {
  return React.useContext(RegisterWizardContext);
}
