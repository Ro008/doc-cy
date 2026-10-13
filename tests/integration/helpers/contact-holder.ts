import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A professional row that counts as REAL for the unique contact rule
 * (`is_test_profile = false`), so it blocks its registration email and mobile.
 * Archived and hidden from the finder so it never shows up anywhere; its
 * `@integration.test` directory email lets `cleanup-test-doctors.mjs` find it if a
 * spec times out before `remove()`.
 */
export async function seedRealContactHolder(
  admin: SupabaseClient,
  input: { email?: string; mobile?: string },
): Promise<{ id: string; email: string; mobile: string | null; remove: () => Promise<void> }> {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const directoryEmail = `contact-holder-${nonce}@integration.test`;
  const email = input.email ?? directoryEmail;
  const { data, error } = await admin
    .from("professionals")
    .insert({
      name: `Contact Holder ${nonce}`,
      slug: `contact-holder-${nonce}`,
      email: directoryEmail,
      registration_email: email,
      mobile_number: input.mobile ?? null,
      is_registered: false,
      is_test_profile: false,
      is_archived: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`contact holder: ${error?.message}`);
  const id = String(data.id);
  return {
    id,
    email,
    mobile: input.mobile ?? null,
    remove: async () => {
      await admin.from("professionals").delete().eq("id", id);
    },
  };
}
