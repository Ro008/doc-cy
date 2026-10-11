"use client";

import * as React from "react";
import { useProfileBookingStep } from "@/components/doctor/profile/ProfileBookingStep";

/**
 * Hides its content while the patient fills in "Your details" (the form's subtitle already names
 * the clinic); back with "Change time". Hidden, not removed, so nothing is rebuilt.
 */
export function HideWhileBookingDetails({
  children,
  ...rest
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const { step } = useProfileBookingStep();
  return (
    <div {...rest} hidden={step === "details"}>
      {children}
    </div>
  );
}
