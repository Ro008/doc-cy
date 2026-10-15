import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import type { ProfessionalRegistrationDetails } from "@/lib/professional-registration-request";

/**
 * What the celebration dialog says after a founder approves a registration (user,
 * 2026-10-15): who is now on DocCy, in what and where, and the link to the new profile.
 */
export type ApprovalCelebrationContent = {
  title: string;
  /** "Cardiology · Limassol": the first specialty and the first clinic's district. */
  detail: string;
  profilePath: string | null;
};

export function approvalCelebration(input: {
  details: Pick<ProfessionalRegistrationDetails, "first_name" | "last_name" | "specialties" | "clinics">;
  slug: string | null | undefined;
}): ApprovalCelebrationContent {
  const name = `${input.details.first_name ?? ""} ${input.details.last_name ?? ""}`.trim();
  const specialty = String(input.details.specialties[0]?.name ?? "").trim();
  const district = String(input.details.clinics[0]?.district ?? "").trim();
  const slug = String(input.slug ?? "").trim();
  return {
    title: `${name || "The profile"} is now on DocCy`,
    detail: [specialty, district].filter(Boolean).join(" · "),
    profilePath: slug ? publicProfessionalProfilePath(slug) : null,
  };
}
