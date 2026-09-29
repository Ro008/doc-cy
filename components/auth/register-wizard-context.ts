"use client";

import * as React from "react";

export type RegisterWizardContextValue = {
  step: number;
  stepCount: number;
  setStep: (step: number) => void;
  goNext: () => Promise<void>;
  /** The Account step is asking the server whether the email / mobile are free. */
  checking: boolean;
  submitLabel: string;
  /** One-line recap per finished step, keyed by step number. */
  summaries: Readonly<Record<number, string>>;
};

export const RegisterWizardContext =
  React.createContext<RegisterWizardContextValue | null>(null);

export function useRegisterWizard(): RegisterWizardContextValue | null {
  return React.useContext(RegisterWizardContext);
}
