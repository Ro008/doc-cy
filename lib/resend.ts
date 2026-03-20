import { Resend } from "resend";

/** Resend free tier: only this sender is allowed without a verified domain. */
export const RESEND_FROM = "onboarding@resend.dev" as const;

export type ResendEmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

/**
 * Sends email via the official Resend Node SDK.
 * Booking flows should not depend on this succeeding (caller try/catch).
 */
export async function sendResendEmail(email: ResendEmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[DocCy] Resend: RESEND_API_KEY missing. Skipping email send.", {
      subject: email.subject,
    });
    return { skipped: true as const };
  }

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: RESEND_FROM,
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  if (error) {
    console.log("[DocCy] Resend error response:", JSON.stringify(error, null, 2));
    console.log("[DocCy] Resend error context:", {
      subject: email.subject,
      to: email.to,
    });
    throw new Error(
      error.message || `Resend send failed (${error.name ?? "unknown"})`
    );
  }

  console.log(
    "[DocCy] Resend success response:",
    JSON.stringify({ data, subject: email.subject, to: email.to }, null, 2)
  );

  return data;
}
