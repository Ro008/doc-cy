import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test.describe("Integration: public Service Menu section", () => {
  test("renders only when doctor has services", async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";

    const normalizeUrl = (u: string) => u.replace(/\/+$/, "");
    const prodSupabase = normalizeUrl(process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "");
    const integrationSupabase = normalizeUrl(supabaseUrl);
    const usingProductionSupabase =
      prodSupabase.length > 0 && integrationSupabase === prodSupabase;
    const unsafeBase = /mydoccy\.com/i.test(baseUrl);

    test.skip(
      !safeEnv || unsafeBase || usingProductionSupabase,
      "Unsafe target or missing INTEGRATION_SAFE_ENV.",
    );
    test.skip(!baseUrl || !supabaseUrl || !serviceRole, "Missing integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const publicClient = createClient(supabaseUrl, anonKey);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const doctorEmail = `service-menu-${nonce}@integration.test`;
    const doctorSlug = `service-menu-${nonce}`;

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
          name: `Service Menu Doctor ${nonce}`,
          specialty: "Medical Aesthetics & Laser",
          email: doctorEmail,
          phone: "+35799123456",
          languages: ["English"],
          license_number: `LIC-SM-${nonce}`,
          license_file_url: `licenses/integration/${nonce}-sm.pdf`,
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

      const serviceInsert = await admin.from("doctor_services").insert([
        { doctor_id: doctorId, name: "Facial Laser", price: "From 50€" },
        { doctor_id: doctorId, name: "Lip Filler", price: "120€" },
      ]);
      if (serviceInsert.error) {
        throw new Error(`Failed inserting doctor services: ${serviceInsert.error.message}`);
      }

      // doctors_public visibility can lag briefly after insert/update triggers.
      let visiblePublic = false;
      for (let i = 0; i < 10; i++) {
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

      await expect(
        page.getByRole("heading", { name: /^Services$/i }),
      ).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Facial Laser")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("From 50€")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Lip Filler")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("120€")).toBeVisible({ timeout: 10000 });

      const clearServices = await admin.from("doctor_services").delete().eq("doctor_id", doctorId);
      if (clearServices.error) {
        throw new Error(`Failed deleting doctor services: ${clearServices.error.message}`);
      }

      await page.goto(`/en/${doctorSlug}`);
      await expect(page.getByRole("heading", { name: /^Services$/i })).toHaveCount(0);
      await expect(page.getByText("Facial Laser")).toHaveCount(0);
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
