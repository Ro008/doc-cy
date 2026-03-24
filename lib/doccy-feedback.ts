export const DOCCY_OPEN_FEEDBACK_EVENT = "doccy:open-feedback";

export type DocCyOpenFeedbackDetail = {
  subject?: string;
};

export function emitOpenFeedback(detail?: DocCyOpenFeedbackDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DOCCY_OPEN_FEEDBACK_EVENT, { detail: detail ?? {} })
  );
}
