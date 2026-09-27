import type { SupabaseClient } from "@supabase/supabase-js";

import { isTestDoctorRegistrationEmail } from "@/lib/doctor-test-profile";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import {
  parseProfessionalRegistrationDetails,
  registrationRequesterName,
  type ProfessionalRegistrationDetails,
} from "@/lib/professional-registration-request";
import { sendResendEmail } from "@/lib/resend";
import { getPublicBookingBaseUrl } from "@/lib/site-url";

/**
 * Emails the founders when an applicant confirms their email and their
 * registration request enters the queue. Best-effort: a failed email never
 * undoes the request.
 */

export type FounderRecipientRow = { email: string | null; role: string | null; is_active: boolean | null };

function splitEmails(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Every active founder, for a real applicant. Test registrations go only to
 * FOUNDER_NOTIFY_EMAIL (or nobody), because Testing's admin_users holds the real
 * founders and integration runs must not reach their inboxes.
 */
export function registrationNotifyRecipients(input: {
  applicantEmail: string;
  founders: FounderRecipientRow[];
  founderNotifyEmail: string | null | undefined;
}): string[] {
  const fallback = [...new Set(splitEmails(input.founderNotifyEmail))];
  if (isTestDoctorRegistrationEmail(input.applicantEmail)) return fallback;
  const founders = [
    ...new Set(
      input.founders
        .filter((row) => row.role === "founder" && row.is_active === true)
        .map((row) => String(row.email ?? "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  return founders.length > 0 ? founders : fallback;
}

export function buildRegistrationRequestNotifyContent(input: {
  requestId: string;
  details: ProfessionalRegistrationDetails;
  siteUrl?: string;
  /** Names of the existing DocCy clinics the applicant picked, by id. */
  clinicNames?: Record<string, string>;
  claimedListingUrl?: string | null;
}): { subject: string; text: string } {
  const { details } = input;
  const base = (input.siteUrl?.trim() || getPublicBookingBaseUrl()).replace(/\/$/, "");
  const name = registrationRequesterName(details);
  const claimed = Boolean(details.claimed_professional_id);
  const tag = claimed ? "[CLAIMED PROFILE]" : "[UNCLAIMED PROFILE]";

  const specialtyLines = details.specialties.map(
    (s) =>
      `- ${s.name} (licence ${s.license_number || "—"})${s.from_catalogue ? "" : " — not in the catalogue"}`,
  );
  const clinicLines = details.clinics.map((c) => {
    const label = c.clinic_id
      ? `${input.clinicNames?.[c.clinic_id] ?? "Clinic"} (DocCy clinic)`
      : `${c.name ?? "Clinic"} (new clinic)`;
    return `- ${label}: ${c.address} · ${c.district}`;
  });

  const lines = [
    "New registration request (email confirmed — waiting for your review)",
    "",
    `Name: ${name}`,
    `Email: ${details.email}`,
    `Mobile: ${details.mobile}`,
    `Gender: ${details.gender}`,
    `GeSY: ${details.gesy ? "yes" : "no"}`,
    `Languages: ${details.languages.join(", ")}`,
    "Specialties:",
    ...specialtyLines,
    "Clinics:",
    ...clinicLines,
    claimed
      ? `Claimed listing: ${input.claimedListingUrl || details.claimed_professional_id}`
      : "Claimed listing: none (search the directory for a match before approving)",
    `Founders' Club place: ${details.founders_club ? "reserved" : "no (standard pricing)"}`,
    "",
    `Request id: ${input.requestId}`,
    `Review: ${base}/internal/directory#requests`,
  ];

  return { subject: `${tag} Registration request: ${name}`, text: lines.join("\n") };
}

/** Loads the request and emails the founders. Never throws. */
export async function notifyFoundersOfRegistrationRequest(
  service: SupabaseClient,
  requestId: string,
): Promise<void> {
  try {
    const { data: request, error } = await service
      .from("request_log")
      .select("id, details, requester_email")
      .eq("id", requestId)
      .maybeSingle();
    if (error || !request) {
      console.error("[DocCy] registration notify: request lookup failed", error?.message);
      return;
    }
    const details = parseProfessionalRegistrationDetails(request.details);
    if (!details) {
      console.error("[DocCy] registration notify: unreadable details", { requestId });
      return;
    }

    const { data: founders } = await service
      .from("admin_users")
      .select("email, role, is_active")
      .eq("role", "founder")
      .eq("is_active", true);
    const recipients = registrationNotifyRecipients({
      applicantEmail: String(request.requester_email ?? details.email),
      founders: (founders ?? []) as FounderRecipientRow[],
      founderNotifyEmail: process.env.FOUNDER_NOTIFY_EMAIL,
    });
    if (recipients.length === 0) return;

    const clinicIds = details.clinics.map((c) => c.clinic_id).filter((id): id is string => Boolean(id));
    const clinicNames: Record<string, string> = {};
    if (clinicIds.length > 0) {
      const { data: clinics } = await service.from("clinics").select("id, name").in("id", clinicIds);
      for (const clinic of clinics ?? []) {
        clinicNames[String(clinic.id)] = String(clinic.name ?? "");
      }
    }

    let claimedListingUrl: string | null = null;
    if (details.claimed_professional_id) {
      const { data: listing } = await service
        .from("professionals")
        .select("slug")
        .eq("id", details.claimed_professional_id)
        .maybeSingle();
      if (listing?.slug) {
        claimedListingUrl = `${getPublicBookingBaseUrl().replace(/\/$/, "")}${publicProfessionalProfilePath(listing.slug)}`;
      }
    }

    const { subject, text } = buildRegistrationRequestNotifyContent({
      requestId,
      details,
      clinicNames,
      claimedListingUrl,
    });
    await sendResendEmail({
      to: recipients.length === 1 ? recipients[0]! : recipients,
      subject,
      text,
      tags: [
        { name: "category", value: "founder-registration-request" },
        { name: "request_id", value: requestId.slice(0, 40) },
      ],
    });
  } catch (error) {
    console.error("[DocCy] registration notify failed", error);
  }
}
