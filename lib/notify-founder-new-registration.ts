import { sendResendEmail } from "@/lib/resend";
import { getPublicBookingBaseUrl } from "@/lib/site-url";

export type NewRegistrationNotifyPayload = {
  doctorId: string;
  fullName: string;
  email: string;
  phone: string;
  specialty: string;
  /** Custom "Other" specialty pending founder approval */
  needsSpecialtyReview: boolean;
};

/**
 * Strips legacy `text=` from webhook query (same idea as prod monitoring curl).
 */
function buildWhatsAppWebhookUrlWithText(webhookUrl: string, text: string): string {
  const trimmed = webhookUrl.trim().replace(/\r|\n/g, "");
  const withoutText = trimmed
    .replace(/([?&])text=[^&]*(&|$)/g, (_m, p1: string, p2: string) =>
      p2 === "&" ? p1 : ""
    )
    .replace(/\?&/g, "?")
    .replace(/&&/g, "&")
    .replace(/[?&]$/, "");
  const u = new URL(withoutText);
  u.searchParams.set("text", text);
  return u.toString();
}

async function sendFounderWhatsApp(webhookUrl: string, text: string): Promise<void> {
  const url = buildWhatsAppWebhookUrlWithText(webhookUrl, text);
  const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    throw new Error(`WhatsApp webhook HTTP ${res.status}`);
  }
}

/**
 * Best-effort alerts when a professional completes signup (pending your verification).
 *
 * Configure either or both:
 * - FOUNDER_NOTIFY_EMAIL — Resend recipient(s), comma-separated allowed
 * - FOUNDER_REGISTRATION_WHATSAPP_WEBHOOK_URL — GET webhook with `text` param (e.g. same style as WHATSAPP_WEBHOOK_URL in CI)
 */
export async function notifyFounderNewRegistration(
  payload: NewRegistrationNotifyPayload
): Promise<void> {
  const emailTo = process.env.FOUNDER_NOTIFY_EMAIL?.trim();
  const waWebhook = process.env.FOUNDER_REGISTRATION_WHATSAPP_WEBHOOK_URL?.trim();

  if (!emailTo && !waWebhook) {
    return;
  }

  const base = getPublicBookingBaseUrl();
  const reviewPath = "/internal/directory";
  const reviewUrl = `${base}${reviewPath}`;

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

  const textBody = lines.join("\n");
  const shortWa = `DocCy: new signup — ${payload.fullName} (${payload.specialty}). Verify: ${reviewUrl}`;

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
          subject: `[DocCy] New registration — ${payload.fullName}`,
          text: textBody,
        })
      );
    }
  }

  if (waWebhook) {
    tasks.push(sendFounderWhatsApp(waWebhook, shortWa));
  }

  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[DocCy] Founder registration notify channel failed", r.reason);
    }
  }
}
