import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseProfessionalContactUse,
  type ProfessionalContactUse,
} from "@/lib/professional-contact";

/**
 * Server side of the unique contact rule: asks the database whether an email / mobile
 * is already used by another real professional, a real pending application, or (the
 * email) another login. `applicantAuthUserId` excludes the applicant's own login,
 * request and profile. Service role only.
 */
export async function checkProfessionalContact(
  service: SupabaseClient,
  input: { email?: string | null; mobile?: string | null; applicantAuthUserId?: string | null },
): Promise<ProfessionalContactUse> {
  const { data, error } = await service.rpc("professional_contact_in_use", {
    p_email: input.email?.trim() || null,
    p_mobile: input.mobile?.trim() || null,
    p_applicant_auth_user_id: input.applicantAuthUserId ?? null,
  });
  if (error) throw new Error(`contact check: ${error.message}`);
  return parseProfessionalContactUse(data);
}
