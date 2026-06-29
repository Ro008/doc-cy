import { sendResendEmail } from "@/lib/resend";
import { getPublicBookingBaseUrl } from "@/lib/site-url";
import { sendWhatsAppWebhookMessage } from "@/lib/whatsapp-webhook.mjs";

export type NewRegistrationNotifyPayload = {
  doctorId: string;
  fullName: string;
  email: string;
  phone: string;
  specialty: string;
  /** Custom "Other" specialty pending founder approval */
  needsSpecialtyReview: boolean;
};

function resolveFounderWhatsAppWebhook(): string | null {
  const dedicated = process.env.FOUNDER_REGISTRATION_WHATSAPP_WEBHOOK_URL?.trim();
  if (dedicated) return dedicated;
  return process.env.WHATSAPP_WEBHOOK_URL?.trim() || null;
}

/**
 * Best-effort alerts when a professional completes signup (pending your verification).
 *
 * Configure either or both:
 * - FOUNDER_NOTIFY_EMAIL — Resend recipient(s), comma-separated allowed
 * - FOUNDER_REGISTRATION_WHATSAPP_WEBHOOK_URL — webhook URL (falls back to WHATSAPP_WEBHOOK_URL)
 */
export function buildFounderNewRegistrationNotifyContent(
  payload: NewRegistrationNotifyPayload,
  siteUrl?: string,
): { subject: string; textBody: string; shortWa: string; reviewUrl: string } {
  const base = (siteUrl?.trim() || getPublicBookingBaseUrl()).replace(/\/$/, "");
  const reviewUrl = `${base}/internal/directory`;

  const lines = [
    `New professional registration (pending verification)`,
    `Name: ${payload.fullName}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone}`,
    `Specialty: ${payload.specialty}`,
    payload.needsSpecialtyReview ? `Note: custom specialty pending your approval` : null,
    `Doctor id: ${payload.doctorId}`,
    `Review: ${reviewUrl}`,
  ].filter(Boolean) as string[];

  return {
    subject: `[DocCy] New registration — ${payload.fullName}`,
    textBody: lines.join("\n"),
    shortWa: `DocCy: new signup — ${payload.fullName} (${payload.specialty}). Verify: ${reviewUrl}`,
    reviewUrl,
  };
}

export async function notifyFounderNewRegistration(
  payload: NewRegistrationNotifyPayload
): Promise<void> {
  const emailTo = process.env.FOUNDER_NOTIFY_EMAIL?.trim();
  const waWebhook = resolveFounderWhatsAppWebhook();

  if (!emailTo && !waWebhook) {
    return;
  }

  const { subject, textBody, shortWa } = buildFounderNewRegistrationNotifyContent(payload);

  const tasks: Promise<unknown>[] = [];

  if (emailTo) {
    const recipients = emailTo
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length) {
      tasks.push(
        sendResendEmail({
          to: recipients.length === 1 ? recipients[0]! : recipients,
          subject,
          text: textBody,
        })
      );
    }
  }

  if (waWebhook) {
    tasks.push(
      (async () => {
        const result = await sendWhatsAppWebhookMessage(waWebhook, shortWa);
        if (result.ok === false) {
          throw new Error(
            `WhatsApp webhook failed: ${result.error}\n${result.log.join("\n")}`
          );
        }
      })()
    );
  }

  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[DocCy] Founder registration notify channel failed", r.reason);
    }
  }
}
