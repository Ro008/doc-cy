import { expect, test } from "@playwright/test";
import { finishEmailedSignIn, seedProfessionalSpecialty } from "./helpers/test-doctor";
import { createClient } from "@supabase/supabase-js";

test.describe("Integration UI: doctor settings Service Menu", () => {
  test("doctor can add and delete a service from settings", async ({ page }) => {
    test.setTimeout(120_000);
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
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const doctorEmail = `svc-ui-${nonce}@integration.test`;
    const doctorPassword = "StrongPass123!";
    const doctorSlug = `svc-ui-${nonce}`;

    let authUserId = "";
    let doctorId = "";

    try {
      const createUserRes = await admin.auth.admin.createUser({
        email: doctorEmail,
        password: doctorPassword,
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (createUserRes.error || !createUserRes.data.user?.id) {
        throw new Error(`Failed creating integration auth user: ${createUserRes.error?.message}`);
      }
      authUserId = createUserRes.data.user.id;

      const doctorInsert = await admin
        .from("professionals")
        .insert({
          auth_user_id: authUserId,
          name: `Service UI Doctor ${nonce}`,
          email: doctorEmail,
          languages: ["English"],
          slug: doctorSlug,
                is_registered: true,
      pro_access_until: new Date(Date.now() + 180 * 86_400_000).toISOString(),
      is_archived: false,
      subscription_tier: "standard",
      // The first-login welcome dialog would cover the settings page.
      trial_notice_seen_at: new Date().toISOString(),

        })
        .select("id")
        .single();
      if (doctorInsert.error || !doctorInsert.data?.id) {
        throw new Error(`Failed creating integration doctor: ${doctorInsert.error?.message}`);
      }
      doctorId = String(doctorInsert.data.id);
      await seedProfessionalSpecialty(admin, doctorId, {
        specialty: "Laser & Medical Aesthetics",
        licenseNumber: `LIC-SVC-UI-${nonce}`,
      });

      await page.goto("/login");
      await page.getByLabel("Email").fill(doctorEmail);
      await page.locator('input[name="password"]').fill(doctorPassword);
      await page.getByRole("button", { name: /sign in/i }).click();
      await finishEmailedSignIn(page, admin, doctorEmail);
      await page.waitForURL(/\/(agenda|dashboard)/, { timeout: 30_000 });
      await page.goto("/settings?section=services");

      const uniqueService = `UI Service ${Date.now()}`;
      // The price list (2026-10-10): a name, an amount in euros and "starting price".
      const form = page.getByTestId("settings-service-form");
      const serviceInput = form.getByLabel(/^Service/);

      await expect(serviceInput).toBeVisible({ timeout: 15000 });
      const row = page.getByTestId("settings-services").getByRole("listitem").filter({ hasText: uniqueService });
      // Retried until the page reacts (a click before hydration does nothing); once the
      // service is listed the form has closed and there is nothing left to fill.
      await expect(async () => {
        if (await form.isVisible()) {
          await serviceInput.fill(uniqueService, { timeout: 2_000 });
          await form.getByLabel(/^Price/).fill("90", { timeout: 2_000 });
          await form.getByLabel(/This is a starting price/).check({ timeout: 2_000 });
          await form.getByRole("button", { name: "Add service" }).click({ timeout: 2_000 });
        }
        await expect(row).toContainText("From €90", { timeout: 10_000 });
      }).toPass({ timeout: 60_000 });

      await page.getByRole("button", { name: `Remove ${uniqueService}` }).click();
      await expect(row).toHaveCount(0, { timeout: 15000 });
    } finally {
      if (doctorId) {
        await admin.from("professional_services").delete().eq("professional_id", doctorId);
        await admin.from("professional_settings").delete().eq("professional_id", doctorId);
        await admin.from("professionals").delete().eq("id", doctorId);
      }
      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});
