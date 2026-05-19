export const DOCCY_OPEN_FEEDBACK_EVENT = "doccy:open-feedback";

/** Locked feedback topic when opening Support from Promote → website button. */
export const DOCCY_FEEDBACK_SUBJECT_WEBSITE_BOOKING =
  "Help with website booking button";

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
