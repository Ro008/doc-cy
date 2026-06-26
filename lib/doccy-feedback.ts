export const DOCCY_OPEN_FEEDBACK_EVENT = "doccy:open-feedback";

/** Locked feedback topic when opening Support from Promote → website button. */
export const DOCCY_FEEDBACK_SUBJECT_WEBSITE_BOOKING =
  "Help with website booking button";

/** Locked feedback topic when requesting an in-person onboarding demo (register page). */
export const DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST = "Demo Request";

/** @deprecated Use DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST */
export const DOCCY_FEEDBACK_SUBJECT_IN_PERSON_DEMO = DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST;

export const DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE =
  "I'd like to book a free in-person demo in the Paphos area. Please contact me by phone at [your number] or by email to schedule.";

/** @deprecated Use DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE */
export const DOCCY_FEEDBACK_IN_PERSON_DEMO_PREFILL_MESSAGE =
  DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE;

export type DocCyOpenFeedbackDetail = {
  subject?: string;
  message?: string;
};

export function emitOpenFeedback(detail?: DocCyOpenFeedbackDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DOCCY_OPEN_FEEDBACK_EVENT, { detail: detail ?? {} })
  );
}
