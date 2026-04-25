import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function normalizeUrl(u: string): string {
  return u.replace(/\/+$/, "");
}

/** Same safety rails as other integration UI tests, plus explicit local app URL only. */
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
    const u = new URL(baseUrl);
    if (u.protocol !== "http:") return "PLAYWRIGHT_BASE_URL must be http for local-only test.";
    const port = u.port || "80";
    // Default dev is :3000; integration scripts use :3100 with `scripts/dev-with-env.mjs`.
    if (!["3000", "3100"].includes(port)) {
      return "PLAYWRIGHT_BASE_URL must use port 3000 or 3100 (local Next).";
    }
    if (!["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) {
      return "PLAYWRIGHT_BASE_URL must be localhost / 127.0.0.1 / ::1 only.";
    }
  } catch {
    return "Invalid PLAYWRIGHT_BASE_URL.";
  }
  return null;
}

test.describe("Integration UI: settings clinic address notice (local only)", () => {
  test("shows address prompt when clinic address is empty", async ({ page }) => {
    test.setTimeout(120_000);
    const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "").trim() || "http://localhost:3000";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeLocalIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!supabaseUrl || !serviceRole, "Missing Supabase credentials.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const doctorEmail = `addr-notice-${nonce}@integration.test`;
    const doctorPassword = "StrongPass123!";
    const doctorSlug = `addr-notice-${nonce}`;

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
        throw new Error(`Failed creating auth user: ${createUserRes.error?.message}`);
      }
      authUserId = createUserRes.data.user.id;

      const doctorInsert = await admin
        .from("doctors")
        .insert({
          auth_user_id: authUserId,
          name: `Address Notice Doctor ${nonce}`,
          specialty: "Medical Aesthetics & Laser",
          district: "Nicosia",
          clinic_address: "",
          email: doctorEmail,
          phone: "+35799123456",
          languages: ["English"],
          license_number: `LIC-ADDR-${nonce}`,
          license_file_url: `licenses/integration/${nonce}-addr-notice.pdf`,
          status: "verified",
          slug: doctorSlug,
          is_specialty_approved: true,
          subscription_tier: "standard",
        })
        .select("id")
        .single();
      if (doctorInsert.error || !doctorInsert.data?.id) {
        throw new Error(`Failed creating doctor: ${doctorInsert.error?.message}`);
      }
      doctorId = String(doctorInsert.data.id);

      await page.goto("/login");
      await page.getByLabel("Email").fill(doctorEmail);
      await page.getByLabel("Password").fill(doctorPassword);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(/\/agenda(?:[/?#]|$)/i, { timeout: 30_000 });

      await page.goto("/agenda/settings", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/agenda\/settings(?:[/?#]|$)/i, { timeout: 20_000 });

      const notice = page.getByRole("status").filter({ hasText: "Add your clinic address" });
      await expect(notice).toBeVisible({ timeout: 20_000 });
      await expect(notice.getByText(/Google Maps/i)).toBeVisible();
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
