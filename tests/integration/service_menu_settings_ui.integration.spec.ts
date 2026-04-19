import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test.describe("Integration UI: doctor settings Service Menu", () => {
  test("doctor can add and delete a service from settings", async ({ page }) => {
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
        .from("doctors")
        .insert({
          auth_user_id: authUserId,
          name: `Service UI Doctor ${nonce}`,
          specialty: "Medical Aesthetics & Laser",
          email: doctorEmail,
          phone: "+35799123456",
          languages: ["English"],
          license_number: `LIC-SVC-UI-${nonce}`,
          license_file_url: `licenses/integration/${nonce}-svc-ui.pdf`,
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

      await page.goto("/login");
      await page.getByLabel("Email").fill(doctorEmail);
      await page.getByLabel("Password").fill(doctorPassword);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL("**/agenda", { timeout: 15000 });
      await page.goto("/agenda/settings");

      const uniqueService = `UI Service ${Date.now()}`;
      const serviceInput = page.getByPlaceholder("Treatment name (e.g. Facial laser)");
      const priceInput = page.getByPlaceholder("e.g. 120 or From 80");
      const addButton = page.getByRole("button", { name: /^Add$/ });

      await expect(serviceInput).toBeVisible({ timeout: 15000 });
      await serviceInput.fill(uniqueService);
      await priceInput.fill("From 90€");
      await addButton.click();

      await expect(page.getByText(uniqueService)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("From 90€")).toBeVisible({ timeout: 15000 });

      await page.getByRole("button", { name: `Delete ${uniqueService}` }).click();
      await expect(page.getByText(uniqueService)).toHaveCount(0);
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
