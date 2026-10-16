import { validateFeedbackSubmission } from "@/lib/doccy-feedback";

/** Caps for what the support form may store (the form itself has no limits). */
export const SUPPORT_MESSAGE_LIMITS = {
  topic: 80,
  message: 5000,
  email: 254,
  url: 500,
  contextValue: 200,
  contextKeys: 10,
} as const;

export type SupportMessageInput = {
  topic: string;
  message: string;
  /** Null when a signed-in sender left it out. */
  email: string | null;
  url: string | null;
  /** Extra facts the form opened with, e.g. the listing of a "Report incorrect info". */
  context: Record<string, string> | null;
};

export type ParsedSupportMessage =
  | { ok: true; value: SupportMessageInput }
  | { ok: false; reason: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseContext(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= SUPPORT_MESSAGE_LIMITS.contextKeys) break;
    const cleaned = text(value).slice(0, SUPPORT_MESSAGE_LIMITS.contextValue);
    if (cleaned && key.length <= 40) out[key] = cleaned;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Reads the body of POST /api/support-message with the same rules as the form. */
export function parseSupportMessageBody(raw: unknown, signedIn: boolean): ParsedSupportMessage {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "invalid_body" };
  }
  const body = raw as Record<string, unknown>;
  const topic = text(body.subject);
  const message = typeof body.message === "string" ? body.message : "";
  const email = text(body.email);

  if (!topic || topic.length > SUPPORT_MESSAGE_LIMITS.topic) return { ok: false, reason: "invalid_topic" };
  if (message.length > SUPPORT_MESSAGE_LIMITS.message) return { ok: false, reason: "message_too_long" };
  if (email.length > SUPPORT_MESSAGE_LIMITS.email) return { ok: false, reason: "invalid_email" };

  const problem = validateFeedbackSubmission({ message, email, signedIn });
  if (problem) return { ok: false, reason: problem };

  return {
    ok: true,
    value: {
      topic,
      message: message.trim(),
      email: email || null,
      url: text(body.url).slice(0, SUPPORT_MESSAGE_LIMITS.url) || null,
      context: parseContext(body.context),
    },
  };
}
