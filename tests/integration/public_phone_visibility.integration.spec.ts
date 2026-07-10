import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function normalizeUrl(u: string): string {
  return u.replace(/\/+$/, "");
}

function assertSafeIntegrationTarget(baseUrl: string, supabaseUrl: string): string | null {
  const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";
  const prodSupabase = normalizeUrl(process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "");
  const integrationSupabase = normalizeUrl(supabaseUrl);
  const usingProductionSupabase =
    prodSupabase.length > 0 && integrationSupabase === prodSupabase;
  const unsafeBase = /mydoccy\.com/i.test(baseUrl);
  if (!safeEnv || unsafeBase || usingProductionSupabase) {
    return "Unsafe target or missing INTEGRATION_SAFE_ENV.";
  }
  return null;
}

test.describe("Integration: public phone visibility toggle", () => {
  test("public profile hides/shows contact based on show_phone_public", async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!baseUrl || !supabaseUrl || !serviceRole || !anonKey, "Missing integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);
    const publicClient = createClient(supabaseUrl, anonKey);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const doctorEmail = `public-phone-${nonce}@integration.test`;
    const doctorSlug = `public-phone-${nonce}`;
    const publicPhone = "+35799123456";

    let authUserId = "";
    let doctorId = "";

    try {
      const createUserRes = await admin.auth.admin.createUser({
        email: doctorEmail,
        password: "StrongPass123!",
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createUserRes.error || !createUserRes.data.user?.id) {
        throw new Error(`Failed creating integration auth user: ${createUserRes.error?.message}`);
      }
      authUserId = createUserRes.data.user.id;

      const doctorInsert = await admin
        .from("doctors")
        .insert({
          auth_user_id: authUserId,
          name: `Public Phone Doctor ${nonce}`,
          specialty: "Dentistry",
          district: "Paphos",
          clinic_address: "1 Clinic Street, Paphos",
          email: doctorEmail,
          phone: publicPhone,
          languages: ["English"],
          license_number: `LIC-PHONE-${nonce}`,
          license_file_url: `licenses/integration/${nonce}-public-phone.pdf`,
          status: "verified",
          slug: doctorSlug,
          is_specialty_approved: true,
          subscription_tier: "standard",
        })
        .select("id")
        .single();
      if (doctorInsert.error || !doctorInsert.data?.id) {
        throw new Error(`Failed creating integration doctor: ${doctorInsert.error?.message}`);
      }
      doctorId = String(doctorInsert.data.id);

      const settingsUpsert = await admin.from("doctor_settings").upsert(
        {
          doctor_id: doctorId,
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false,
          start_time: "09:00:00",
          end_time: "17:00:00",
          slot_duration_minutes: 30,
          show_phone_public: false,
        },
        { onConflict: "doctor_id" },
      );
      if (settingsUpsert.error) {
        throw new Error(`Failed preparing doctor settings: ${settingsUpsert.error.message}`);
      }

      let visiblePublic = false;
      for (let i = 0; i < 10; i += 1) {
        const check = await publicClient
          .from("doctors_public")
          .select("id")
          .eq("slug", doctorSlug)
          .maybeSingle();
        if (!check.error && check.data?.id) {
          visiblePublic = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      expect(visiblePublic).toBe(true);

      await page.goto(`/en/${doctorSlug}`);
      await expect(page.getByRole("heading", { name: /^Contact$/i })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /Chat on WhatsApp/i })).toHaveCount(0);
      await expect(page.getByText(publicPhone)).toHaveCount(0);

      const enablePublicPhone = await admin
        .from("doctor_settings")
        .update({ show_phone_public: true })
        .eq("doctor_id", doctorId);
      if (enablePublicPhone.error) {
        throw new Error(`Failed enabling public phone: ${enablePublicPhone.error.message}`);
      }

      await page.goto(`/en/${doctorSlug}`);
      await expect(page.getByRole("heading", { name: /^Contact$/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("link", { name: /Chat on WhatsApp/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(publicPhone)).toBeVisible({ timeout: 10000 });
    } finally {
      if (doctorId) {
        await admin.from("doctor_services").delete().eq("doctor_id", doctorId);
        await admin.from("doctor_settings").delete().eq("doctor_id", doctorId);
        await admin.from("doctors").delete().eq("id", doctorId);
      }
      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});

