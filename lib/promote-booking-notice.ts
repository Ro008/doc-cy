/**
 * Promote (user, 2026-10-11): a sign or link is only worth sharing while patients who
 * follow it can book. When they cannot, the tab says so and points to where it is fixed.
 */

export type PromoteBookingNotice = {
  text: string;
  /** The Settings section that fixes it. */
  section: "plan" | "clinics";
  linkLabel: string;
};

export type PromoteBookingState = {
  accessEnded: boolean;
  /** Holiday mode is on and today falls inside its dates. */
  holidayActive: boolean;
  /** Last holiday day as shown to her (dd/mm/yyyy). */
  holidayEnd: string;
  clinics: { paused: boolean }[];
};

export function promoteBookingNotice(state: PromoteBookingState): PromoteBookingNotice | null {
  if (state.accessEnded) {
    return {
      text: "Your DocCy access has ended, so patients who scan your sign or open your link cannot book online.",
      section: "plan",
      linkLabel: "See your plan",
    };
  }
  if (state.holidayActive) {
    return {
      text: `Holiday mode is on until ${state.holidayEnd}, so patients who scan your sign or open your link cannot book online until then.`,
      section: "clinics",
      linkLabel: "Open Clinics",
    };
  }
  if (state.clinics.length > 0 && state.clinics.every((clinic) => clinic.paused)) {
    const where = state.clinics.length === 1 ? "at your clinic" : "at every clinic";
    return {
      text: `Online booking is paused ${where}, so patients who scan your sign or open your link cannot book online.`,
      section: "clinics",
      linkLabel: "Open Clinics",
    };
  }
  return null;
}
