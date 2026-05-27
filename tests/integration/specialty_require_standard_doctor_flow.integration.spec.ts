import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInDoctorAndSetCookies } from "../helpers/doctorAuth";

function normalizeUrl(u: string): string {
  return u.replace(/\/+$/, "");
}

function assertSafeLocalIntegrationTarget(baseUrl: string, supabaseUrl: string): string | null {
  const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";
  const prodSupabase = normalizeUrl(process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "");
  const integrationSupabase = normalizeUrl(supabaseUrl);
  const usingProductionSupabase =
    prodSupabase.length > 0 && integrationSupabase === prodSupabase;
  const unsafeBase = /mydoccy\.com/i.test(baseUrl);
  if (!safeEnv || unsafeBase || usingProductionSupabase) {
    return "Unsafe target or missing INTEGRATION_SAFE_ENV.";
  }
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "http:") return "PLAYWRIGHT_BASE_URL must be http for local-only test.";
    const port = parsed.port || "80";
    if (!["3000", "3100"].includes(port)) {
      return "PLAYWRIGHT_BASE_URL must use port 3000 or 3100 (local Next).";
    }
    if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
      return "PLAYWRIGHT_BASE_URL must be localhost / 127.0.0.1 / ::1 only.";
    }
  } catch {
    return "Invalid PLAYWRIGHT_BASE_URL.";
  }
  return null;
}

test.describe("Integration UI: require standard specialty doctor resolution", () => {
  test("founder requests standard category and doctor resolves from settings", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "").trim() || "http://localhost:3000";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const internalSecret = process.env.INTERNAL_DIRECTORY_SECRET ?? "";

    const unsafeReason = assertSafeLocalIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!supabaseUrl || !serviceRole, "Missing Supabase credentials.");
    test.skip(!internalSecret, "Missing INTERNAL_DIRECTORY_SECRET.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const doctorEmail = `spec-require-${nonce}@integration.test`;
    const doctorPassword = "StrongPass123!";
    const doctorSlug = `spec-require-${nonce}`;
    const doctorName = `Specialty Require ${nonce}`;

    let authUserId = "";
    let doctorId = "";

    try {
      const created = await admin.auth.admin.createUser({
        email: doctorEmail,
        password: doctorPassword,
        email_confirm: true,
        user_metadata: { role: "doctor" },
      });
      if (created.error || !created.data.user?.id) {
        throw new Error(`Failed creating auth user: ${created.error?.message}`);
      }
      authUserId = created.data.user.id;

      const insertDoctor = await admin
        .from("doctors")
        .insert({
          auth_user_id: authUserId,
          name: doctorName,
          specialty: "meditation",
          district: "Nicosia",
          clinic_address: "Seeded for specialty flow",
          email: doctorEmail,
          phone: "+35799123456",
          languages: ["English"],
          license_number: `LIC-SPEC-${nonce}`,
          license_file_url: `licenses/integration/${nonce}-spec-flow.pdf`,
          status: "verified",
          slug: doctorSlug,
          is_specialty_approved: false,
          specialty_requires_standard_at: null,
          subscription_tier: "founder",
        })
        .select("id")
        .single();
      if (insertDoctor.error || !insertDoctor.data?.id) {
        throw new Error(`Failed creating doctor: ${insertDoctor.error?.message}`);
      }
      doctorId = String(insertDoctor.data.id);

      // Founder marks doctor as "require standard" from internal dashboard.
      await page.context().addCookies([
        {
          name: "doccy-internal-directory",
          value: internalSecret,
          domain: new URL(baseUrl).hostname,
          path: "/",
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
      ]);
      await page.goto("/internal/directory", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/internal\/directory(?:[/?#]|$)/i, { timeout: 20_000 });

      const row = page.locator("li", { hasText: doctorEmail }).first();
      await expect(row).toBeVisible({ timeout: 20_000 });
      await expect(row).toContainText("meditation");
      await row.getByRole("button", { name: "Require standard category" }).click();
      await row.getByRole("button", { name: "Send and remove from queue" }).click();
      await expect(row).toBeHidden({ timeout: 20_000 });

      const afterFounder = await admin
        .from("doctors")
        .select("specialty_requires_standard_at, is_specialty_approved")
        .eq("id", doctorId)
        .single();
      expect(afterFounder.error).toBeNull();
      expect(afterFounder.data?.is_specialty_approved).toBe(false);
      expect(Boolean(afterFounder.data?.specialty_requires_standard_at)).toBe(true);

      // Doctor sees guidance banner and resolves by choosing a standard category.
      await signInDoctorAndSetCookies(page, undefined, {
        email: doctorEmail,
        password: doctorPassword,
      });
      await page.goto("/agenda/settings", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/agenda\/settings(?:[/?#]|$)/i, { timeout: 20_000 });
      await expect(
        page.getByText("We could not add your custom specialty to the DocCy directory."),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByLabel("Describe your specialty *")).toBeVisible();
      await expect(page.getByLabel("Describe your specialty *")).toHaveValue("meditation");

      const specialtyTrigger = page.locator("#settings-specialty-trigger");
      const specialtyListbox = page.getByRole("listbox");
      await specialtyTrigger.click();
      if (!(await specialtyListbox.isVisible().catch(() => false))) {
        await specialtyTrigger.click();
      }
      await expect(specialtyListbox).toBeVisible({ timeout: 10_000 });
      await page.getByPlaceholder("Search…").fill("Pedia");
      await page.getByRole("button", { name: "Pediatrics" }).click();
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(
        page.getByRole("main").getByText("Settings saved."),
      ).toBeVisible({ timeout: 20_000 });

      const afterDoctorSave = await admin
        .from("doctors")
        .select("specialty, is_specialty_approved, specialty_requires_standard_at")
        .eq("id", doctorId)
        .single();
      expect(afterDoctorSave.error).toBeNull();
      expect(afterDoctorSave.data?.specialty).toBe("Pediatrics");
      expect(afterDoctorSave.data?.is_specialty_approved).toBe(true);
      expect(afterDoctorSave.data?.specialty_requires_standard_at).toBeNull();

      const pendingQueue = await admin
        .from("doctors")
        .select("id")
        .eq("is_specialty_approved", false)
        .is("specialty_requires_standard_at", null)
        .eq("id", doctorId);
      expect(pendingQueue.error).toBeNull();
      expect(pendingQueue.data ?? []).toHaveLength(0);

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
