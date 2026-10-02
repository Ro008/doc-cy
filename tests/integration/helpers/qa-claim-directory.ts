import type { SupabaseClient } from "@supabase/supabase-js";
import {
  QA_CLAIM_DIRECTORY_NAME_PREFIX,
  QA_CLAIM_DIRECTORY_SLUG_PREFIX,
} from "@/lib/doctor-test-profile";
import { seedProfessionalClinic, seedProfessionalSpecialty } from "./test-doctor";

export type QaClaimDirectoryClone = {
  id: string;
  slug: string;
  name: string;
  profilePath: string;
  /** Its clinic: delete with `deleteTestClinics` after the professional. */
  clinicId: string;
};

/**
 * Unregistered testing listing used by the local claim-register e2e.
 * Name/slug prefixes are the only listings a test email is allowed to absorb.
 *
 * Like a real listing, its location is a clinic (Point E5).
 *
 * Profile path is inlined (`/en/{slug}`) so Playwright does not load next-intl
 * via `manual-directory-landing-path` (CJS/ESM clash under the test runner).
 */
export async function createQaClaimDirectoryClone(
  admin: SupabaseClient,
  nonce: string,
): Promise<QaClaimDirectoryClone> {
  const slug = `${QA_CLAIM_DIRECTORY_SLUG_PREFIX}ioanna-${nonce}`;
  const name = `${QA_CLAIM_DIRECTORY_NAME_PREFIX}Ioanna Severi ${nonce}`;
  const insert = await admin
    .from("professionals")
    .insert({
      name,
      slug,
      is_registered: false,
      is_archived: false,
      is_test_profile: true,
    })
    .select("id")
    .single();

  if (insert.error || !insert.data?.id) {
    throw new Error(`Failed creating QA claim clone: ${insert.error?.message ?? "missing id"}`);
  }
  await seedProfessionalSpecialty(admin, String(insert.data.id), {
    specialty: "Obstetrics - Gynaecology",
  });
  const { clinicId } = await seedProfessionalClinic(admin, String(insert.data.id), {
    nonce,
    district: "Nicosia",
  });

  return {
    id: String(insert.data.id),
    slug,
    name,
    profilePath: `/en/${encodeURIComponent(slug)}`,
    clinicId,
  };
}
