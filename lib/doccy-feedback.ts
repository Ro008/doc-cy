export const DOCCY_OPEN_FEEDBACK_EVENT = "doccy:open-feedback";

/** Locked feedback topic when opening Support from Promote → website button. */
export const DOCCY_FEEDBACK_SUBJECT_WEBSITE_BOOKING =
  "Help with website booking button";

/** Locked feedback topic when requesting done-for-you onboarding on a call (register page). */
export const DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST = "Onboarding Request";

/** @deprecated Use DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST */
export const DOCCY_FEEDBACK_SUBJECT_IN_PERSON_DEMO = DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST;

export const DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE =
  "I'd like you to set up my DocCy account on a call and walk me through the site. Please contact me by phone at [your number] or by email to schedule.";

/** @deprecated Use DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE */
export const DOCCY_FEEDBACK_IN_PERSON_DEMO_PREFILL_MESSAGE =
  DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE;

export type DocCyOpenFeedbackDetail = {
  subject?: string;
  message?: string;
};

let pendingOpenFeedback: DocCyOpenFeedbackDetail | null = null;

export function emitOpenFeedback(detail?: DocCyOpenFeedbackDetail): void {
  const payload = detail ?? {};
  pendingOpenFeedback = payload;
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DOCCY_OPEN_FEEDBACK_EVENT, { detail: payload })
  );
}

/** Replay a click that happened before the lazy FeedbackWidget chunk loaded. */
export function consumePendingOpenFeedback(): DocCyOpenFeedbackDetail | null {
  const next = pendingOpenFeedback;
  pendingOpenFeedback = null;
  return next;
}

export function subscribeOpenFeedback(
  handler: (detail: DocCyOpenFeedbackDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onEvent = (event: Event) => {
    const ce = event as CustomEvent<DocCyOpenFeedbackDetail>;
    pendingOpenFeedback = null;
    handler(ce.detail ?? {});
  };

  window.addEventListener(DOCCY_OPEN_FEEDBACK_EVENT, onEvent);
  const pending = consumePendingOpenFeedback();
  if (pending) handler(pending);

  return () => {
    window.removeEventListener(DOCCY_OPEN_FEEDBACK_EVENT, onEvent);
  };
}
