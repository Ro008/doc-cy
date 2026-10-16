export const DOCCY_OPEN_FEEDBACK_EVENT = "doccy:open-feedback";

/** Locked feedback topic when requesting done-for-you onboarding on a call (register page). */
export const DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST = "Onboarding Request";

/** Locked topic when a professional asks about a rejected application. */
export const DOCCY_FEEDBACK_SUBJECT_APPLICATION_REVIEW = "Application review inquiry";

/** Query value for emails/links that should open the support form on this topic. */
export const DOCCY_SUPPORT_QUERY_APPLICATION_REVIEW = "application-review";

/** @deprecated Use DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST */
export const DOCCY_FEEDBACK_SUBJECT_IN_PERSON_DEMO = DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST;

export const DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE =
  "I'd like you to set up my DocCy account on a call and walk me through the site. Please contact me by phone at [your number] or by email to schedule.";

/** @deprecated Use DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE */
export const DOCCY_FEEDBACK_IN_PERSON_DEMO_PREFILL_MESSAGE =
  DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE;

/** Last line of the "Report incorrect info" template; the reporter writes underneath it. */
export const INCORRECT_INFO_PROMPT = "What seems incorrect:";

/**
 * False when the "Report incorrect info" template is sent with nothing written under its prompt
 * (a real report arrived like that, 2026-10-14). Other messages are never affected.
 */
export function hasIncorrectInfoDetails(message: string): boolean {
  const at = message.lastIndexOf(INCORRECT_INFO_PROMPT);
  if (at === -1) return true;
  return message.slice(at + INCORRECT_INFO_PROMPT.length).trim().length > 0;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * First problem with a support submission, or null when it can be sent. A visitor without a session
 * must leave an email, otherwise we cannot answer; a signed-in user may leave it out (we have their
 * account) but an address they did type must still be valid.
 */
export function validateFeedbackSubmission(input: {
  message: string;
  email: string;
  signedIn: boolean;
}): string | null {
  if (!input.message.trim()) return "Please write a short message.";
  if (!hasIncorrectInfoDetails(input.message)) {
    return `Please tell us what seems incorrect — write it under "${INCORRECT_INFO_PROMPT}".`;
  }
  const email = input.email.trim();
  if (!email) {
    return input.signedIn ? null : "Please enter your email so we can get back to you.";
  }
  return EMAIL_PATTERN.test(email) ? null : "Please enter a valid email address.";
}

/** Second line of the "sent" confirmation: no promise of a reply when we have no way to send one. */
export function feedbackSentFollowUp(hasEmail: boolean): string {
  return hasEmail
    ? "We'll follow up as soon as possible."
    : "Thanks for helping us improve DocCy.";
}

export type DocCyOpenFeedbackDetail = {
  subject?: string;
  message?: string;
  /** Facts the opener knows (e.g. the listing being reported), saved with the message. */
  context?: Record<string, string>;
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
