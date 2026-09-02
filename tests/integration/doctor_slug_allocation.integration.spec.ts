import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { allocateUniqueDoctorSlug } from "@/lib/doctor-slug";

function normalizeUrl(u: string): string {
  return u.replace(/\/+$/, "");
}

function assertSafeIntegrationTarget(supabaseUrl: string): string | null {
  const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";
  const prodSupabase = normalizeUrl(process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "");
  const integrationSupabase = normalizeUrl(supabaseUrl);
  const usingProductionSupabase =
    prodSupabase.length > 0 && integrationSupabase === prodSupabase;
  if (!safeEnv || usingProductionSupabase) {
    return "Unsafe target or missing INTEGRATION_SAFE_ENV.";
  }
  return null;
}

test.describe("Integration: doctor slug allocation", () => {
  test("allocates distinct slugs for doctors with the same name", async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!supabaseUrl || !serviceRole, "Missing integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const sharedName = `Slug Collision ${nonce}`;
    const createdDoctorIds: string[] = [];
    const createdAuthUserIds: string[] = [];
    const allocatedSlugs: string[] = [];

    try {
      for (let index = 0; index < 2; index += 1) {
        const email = `slug-collision-${nonce}-${index}@integration.test`;
        const createUserRes = await admin.auth.admin.createUser({
          email,
          password: "StrongPass123!",
          email_confirm: true,
          user_metadata: { role: "doctor" },
        });
        if (createUserRes.error || !createUserRes.data.user?.id) {
          throw new Error(`Failed creating auth user: ${createUserRes.error?.message}`);
        }
        const authUserId = createUserRes.data.user.id;
        createdAuthUserIds.push(authUserId);

        const slug = await allocateUniqueDoctorSlug(admin, {
          name: sharedName,
          district: "Paphos",
          authUserId,
        });
        allocatedSlugs.push(slug);

        const doctorInsert = await admin
          .from("professionals")
          .insert({
            auth_user_id: authUserId,
            name: sharedName,
            specialty: "Dentistry",
            district: "Paphos",
            clinic_address: "1 Clinic Street, Paphos",
            email,
            phone: "+35799123456",
            languages: ["English"],
            license_number: `LIC-SLUG-${nonce}-${index}`,
            license_file_url: `licenses/integration/${nonce}-${index}.pdf`,
            status: "verified",
            slug,
            is_specialty_approved: true,
                  is_registered: true,
      has_online_booking: true,
      finder_visible: true,
      is_archived: false,
      subscription_tier: "standard",

          })
          .select("id, slug")
          .single();

        if (doctorInsert.error || !doctorInsert.data?.id) {
          throw new Error(`Failed creating doctor: ${doctorInsert.error?.message}`);
        }

        createdDoctorIds.push(String(doctorInsert.data.id));
      }

      expect(allocatedSlugs[0]).toBe(`slug-collision-${nonce}`);
      expect(allocatedSlugs[1]).toBe(`slug-collision-${nonce}-paphos`);
      expect(new Set(allocatedSlugs).size).toBe(2);

      const { data: rows, error } = await admin
        .from("professionals")
        .select("slug")
        .in("id", createdDoctorIds);
      if (error) {
        throw new Error(`Failed reading created doctor slugs: ${error.message}`);
      }

      const slugs = (rows ?? []).map((row) => String(row.slug));
      expect(new Set(slugs).size).toBe(2);
    } finally {
      for (const doctorId of createdDoctorIds) {
        await admin.from("doctor_settings").delete().eq("doctor_id", doctorId);
        await admin.from("professionals").delete().eq("id", doctorId);
      }
      for (const authUserId of createdAuthUserIds) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});
