"use client";

import * as React from "react";

export type RegisterWizardContextValue = {
  step: number;
  stepCount: number;
  setStep: (step: number) => void;
};

export const RegisterWizardContext =
  React.createContext<RegisterWizardContextValue | null>(null);

export function useRegisterWizard(): RegisterWizardContextValue | null {
  return React.useContext(RegisterWizardContext);
}
