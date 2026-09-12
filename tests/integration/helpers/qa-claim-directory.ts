import type { SupabaseClient } from "@supabase/supabase-js";
import {
  QA_CLAIM_DIRECTORY_NAME_PREFIX,
  QA_CLAIM_DIRECTORY_SLUG_PREFIX,
} from "@/lib/doctor-test-profile";

export type QaClaimDirectoryClone = {
  id: string;
  slug: string;
  name: string;
  profilePath: string;
};

/**
 * Unregistered testing listing used by the local claim-register e2e.
 * Name/slug prefixes are the only listings a test email is allowed to absorb.
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
      specialty: "Gynecology",
      specialties: ["Gynecology"],
      district: "Nicosia",
      slug,
      clinic_address: "Archiepiskopou Makariou III, Nicosia 1065, Cyprus",
      address: "Archiepiskopou Makariou III, Nicosia 1065, Cyprus",
      address_maps_link: "https://maps.google.com/?q=qa-claim-ioanna-e2e",
      latitude: 35.1856,
      longitude: 33.3823,
      is_registered: false,
      has_online_booking: false,
      finder_visible: true,
      is_archived: false,
      is_test_profile: true,
    })
    .select("id")
    .single();

  if (insert.error || !insert.data?.id) {
    throw new Error(`Failed creating QA claim clone: ${insert.error?.message ?? "missing id"}`);
  }

  return {
    id: String(insert.data.id),
    slug,
    name,
    profilePath: `/en/${encodeURIComponent(slug)}`,
  };
}
