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
 * Best-effort email when a professional completes signup (pending your verification).
 *
 * Configure FOUNDER_NOTIFY_EMAIL — Resend recipient(s), comma-separated allowed.
 */
export function buildFounderNewRegistrationNotifyContent(
  payload: NewRegistrationNotifyPayload,
  siteUrl?: string,
): { subject: string; textBody: string; reviewUrl: string } {
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
    reviewUrl,
  };
}

export async function notifyFounderNewRegistration(
  payload: NewRegistrationNotifyPayload
): Promise<void> {
  const emailTo = process.env.FOUNDER_NOTIFY_EMAIL?.trim();
  if (!emailTo) {
    return;
  }

  const { subject, textBody } = buildFounderNewRegistrationNotifyContent(payload);

  const recipients = emailTo
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!recipients.length) {
    return;
  }

  try {
    await sendResendEmail({
      to: recipients.length === 1 ? recipients[0]! : recipients,
      subject,
      text: textBody,
    });
  } catch (reason) {
    console.error("[DocCy] Founder registration notify email failed", reason);
  }
}
