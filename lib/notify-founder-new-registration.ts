import { sendResendEmail } from "@/lib/resend";
import { getPublicBookingBaseUrl } from "@/lib/site-url";
import { formatPendingRegistrationNotifyLines } from "@/lib/pending-registration-review";

export type NewRegistrationNotifyPayload = {
  doctorId: string;
  fullName: string;
  email: string;
  phone: string;
  specialty: string;
  /** Custom "Other" specialty pending founder approval */
  needsSpecialtyReview: boolean;
  claimedDirectory?: boolean;
  languages?: string[];
  specialties?: {
    specialty: string;
    licenseNumber: string | null;
    isApproved: boolean;
  }[];
  primaryLicenseNumber?: string | null;
  locations?: {
    district: string | null;
    town: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    placeId: string | null;
    isPrimary: boolean;
  }[];
  hasAvatar?: boolean;
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
  const reviewUrl = `${base}/internal/directory#pending-registration-review`;

  const detailLines = formatPendingRegistrationNotifyLines({
    name: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    languages: payload.languages ?? [],
    specialties: (payload.specialties ?? []).map((s) => ({
      id: null,
      specialty: s.specialty,
      licenseNumber: s.licenseNumber,
      isApproved: s.isApproved,
    })),
    primarySpecialty: payload.specialty,
    primaryLicenseNumber: payload.primaryLicenseNumber ?? null,
    locations: payload.locations ?? [],
    fromDirectoryListing: Boolean(payload.claimedDirectory),
    avatarUrl: payload.hasAvatar ? "yes" : null,
  });

  const lines = [
    `New professional registration (email confirmed — pending verification)`,
    ...detailLines,
    payload.needsSpecialtyReview ? `Note: custom specialty pending your approval` : null,
    payload.claimedDirectory
      ? `This person claimed their existing finder listing (same professional id). Pending verification — patients keep the same public profile.`
      : null,
    `Professional id: ${payload.doctorId}`,
    `Review: ${reviewUrl}`,
  ].filter(Boolean) as string[];

  return {
    subject: payload.claimedDirectory
      ? `[DocCy] Finder listing claimed — ${payload.fullName}`
      : `[DocCy] New registration — ${payload.fullName}`,
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
      tags: [
        { name: "category", value: "founder-new-registration" },
        { name: "doctor_id", value: payload.doctorId.slice(0, 40) },
      ],
    });
  } catch (reason) {
    console.error("[DocCy] Founder registration notify email failed", reason);
  }
}
