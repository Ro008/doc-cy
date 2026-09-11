import { sendResendEmail } from "@/lib/resend";
import { getPublicBookingBaseUrl } from "@/lib/site-url";
import { formatPendingRegistrationNotifyLines } from "@/lib/pending-registration-review";
import {
  founderNotifyNoteForOrigin,
  founderNotifySubjectForOrigin,
  type PendingRegistrationOriginKind,
} from "@/lib/pending-registration-origin";

export type NewRegistrationNotifyPayload = {
  doctorId: string;
  fullName: string;
  email: string;
  phone: string;
  specialty: string;
  /** Custom "Other" specialty pending founder approval */
  needsSpecialtyReview: boolean;
  /** @deprecated Prefer originKind */
  claimedDirectory?: boolean;
  originKind?: PendingRegistrationOriginKind;
  originLabel?: string;
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

function resolveOriginKind(
  payload: NewRegistrationNotifyPayload,
): PendingRegistrationOriginKind {
  if (payload.originKind) return payload.originKind;
  if (payload.claimedDirectory) return "claimed_listing";
  return "unclaimed_review";
}

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
  const originKind = resolveOriginKind(payload);
  const originLabel =
    payload.originLabel?.trim() ||
    (originKind === "claimed_listing"
      ? "Claimed listing"
      : originKind === "auto_matched_listing"
        ? "Auto-matched listing"
        : originKind === "possible_twin"
          ? "Possible twin"
          : "Unclaimed — review");

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
    locations: (payload.locations ?? []).map((loc) => ({
      id: null,
      district: loc.district,
      town: loc.town,
      address: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
      placeId: loc.placeId,
      isPrimary: loc.isPrimary,
    })),
    fromDirectoryListing:
      originKind === "claimed_listing" || originKind === "auto_matched_listing",
    originKind,
    originLabel,
    avatarUrl: payload.hasAvatar ? "yes" : null,
  });

  const lines = [
    `New professional registration (email confirmed — pending verification)`,
    ...detailLines,
    payload.needsSpecialtyReview ? `Note: custom specialty pending your approval` : null,
    founderNotifyNoteForOrigin(originKind),
    `Professional id: ${payload.doctorId}`,
    `Review: ${reviewUrl}`,
  ].filter(Boolean) as string[];

  return {
    subject: founderNotifySubjectForOrigin(originKind, payload.fullName),
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
