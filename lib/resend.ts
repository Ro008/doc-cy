import { Resend } from "resend";

/**
 * Production sender (verified domain in Resend).
 * Override with RESEND_FROM for local/dev (e.g. Resend onboarding address).
 */
export function getResendFrom(): string {
  const trimmed = process.env.RESEND_FROM?.trim();
  if (trimmed) return trimmed;
  return "DocCy <no-reply@mydoccy.com>";
}

export const AUTOMATED_EMAIL_FOOTER_TEXT =
  "This is an automated message. Please do not reply. For support or feedback, please use the links provided in the app.";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Subtle footer for HTML booking emails (doctor + patient). */
export function automatedEmailFooterHtml(): string {
  return `<p style="margin:28px 0 0;padding-top:18px;border-top:1px solid rgba(148,163,184,.18);font-size:11px;line-height:1.55;color:#64748b;">
  ${escapeHtml(AUTOMATED_EMAIL_FOOTER_TEXT)}
</p>`;
}

export type ResendEmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

/**
 * Sends email via the official Resend Node SDK.
 * No reply_to — discourages replies to automated mail.
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
    from: getResendFrom(),
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
