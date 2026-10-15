"use client";

import * as React from "react";

/**
 * Which step of the booking the patient is on, shared by the booking form (which sets it) and
 * the clinic picker above it (which steps aside on "details"). A context rather than a window
 * event, on purpose: the form sets it in a layout effect, so the picker hides in the same task as
 * the form appears, before the form scrolls itself into view. With an event the picker hid a
 * little later, after the scroll target was computed, and the page stopped short of the form.
 */
export type ProfileBookingStep = "time" | "details";

type Value = { step: ProfileBookingStep; setStep: (step: ProfileBookingStep) => void };

const Ctx = React.createContext<Value>({ step: "time", setStep: () => undefined });

export function ProfileBookingStepProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = React.useState<ProfileBookingStep>("time");
  const value = React.useMemo(() => ({ step, setStep }), [step]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfileBookingStep(): Value {
  return React.useContext(Ctx);
}

// useLayoutEffect warns when a client component renders on the server.
export const useIsomorphicLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;
