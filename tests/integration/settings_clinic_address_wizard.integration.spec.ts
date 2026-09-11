import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInDoctorAndSetCookies } from "../helpers/doctorAuth";

/**
 * Pareto regression for the Paloma-style clinic address bug:
 * 1) Empty address must never surface the hardcoded Evangelismos fallback on the public profile.
 * 2) Settings must offer the same MAP wizard as signup (pin path works without Google).
 * 3) Saving a confirmed address must persist on the public profile.
 */

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
    const u = new URL(baseUrl);
    if (u.protocol !== "http:") return "PLAYWRIGHT_BASE_URL must be http for local-only test.";
    const port = u.port || "80";
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

async function typeAddress(page: Page, text: string): Promise<void> {
  const input = page.getByLabel("Address patients will see");
  await input.click();
  await input.pressSequentially(text, { delay: 10 });
}

/**
 * The Settings card uses backdrop-blur, which used to trap `position: fixed`
 * and hide the sheet chrome — doctors saw only the map and could not exit.
 */
async function expectPinSheetChromeUsable(page: Page): Promise<void> {
  const sheet = page.getByTestId("clinic-pin-sheet");
  await expect(sheet).toBeVisible({ timeout: 15_000 });

  const header = sheet.getByTestId("clinic-pin-sheet-header");
  const footer = sheet.getByTestId("clinic-pin-sheet-footer");
  await expect(header).toBeVisible();
  await expect(footer).toBeVisible();
  await expect(sheet.getByText("Put the pin on your clinic")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Use this location" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Cancel" })).toBeVisible();

  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  const headerBox = await header.boundingBox();
  const footerBox = await footer.boundingBox();
  expect(headerBox).toBeTruthy();
  expect(footerBox).toBeTruthy();
  // Sheet is portaled to body — chrome must sit in the real viewport.
  expect(headerBox!.y).toBeLessThan(64);
  expect(footerBox!.y).toBeGreaterThan(headerBox!.y);
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(viewport!.height + 2);
}

test.describe("Integration UI: settings clinic address wizard (Pareto)", { tag: "@pr-e2e" }, () => {
  test("empty profile hides Evangelismos; wizard save shows real address", async ({ page }) => {
    test.setTimeout(150_000);
    const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "").trim() || "http://localhost:3000";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeLocalIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!supabaseUrl || !serviceRole, "Missing Supabase credentials.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const doctorEmail = `addr-wizard-${nonce}@integration.test`;
    const doctorPassword = "StrongPass123!";
    const doctorSlug = `addr-wizard-${nonce}`;
    const savedAddress = "12 Makariou Avenue, 2nd floor";

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
        .from("professionals")
        .insert({
          auth_user_id: authUserId,
          name: `Address Wizard Doctor ${nonce}`,
          specialty: "Cardiology",
          district: "Limassol",
          clinic_address: "",
          latitude: null,
          longitude: null,
          clinic_place_id: null,
          email: doctorEmail,
          phone: "+35799123456",
          languages: ["English"],
          license_number: `LIC-ADDR-WIZ-${nonce}`,
          license_file_url: `licenses/integration/${nonce}-addr-wizard.pdf`,
          status: "verified",
          slug: doctorSlug,
          is_specialty_approved: true,
          is_registered: true,
          has_online_booking: true,
          finder_visible: true,
          is_archived: false,
          subscription_tier: "standard",
          trial_notice_seen_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (doctorInsert.error || !doctorInsert.data?.id) {
        throw new Error(`Failed creating doctor: ${doctorInsert.error?.message}`);
      }
      doctorId = String(doctorInsert.data.id);

      // 1) Public profile must not invent Evangelismos when address is missing.
      await page.goto(`/en/${doctorSlug}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Address Wizard Doctor/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(/Evangelismos/i)).toHaveCount(0);
      await expect(page.getByRole("heading", { name: /^Location$/i })).toHaveCount(0);

      // 2) Settings MAP wizard (same as signup): drop a pin, type address, save.
      await signInDoctorAndSetCookies(page, undefined, {
        email: doctorEmail,
        password: doctorPassword,
      });
      await page.goto("/agenda/settings", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/agenda\/settings(?:[/?#]|$)/i, { timeout: 20_000 });

      const wizard = page.getByTestId("settings-clinic-address-wizard");
      await expect(wizard).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByRole("status").filter({ hasText: "Add your clinic address" }),
      ).toBeVisible();

      await wizard.getByRole("button", { name: "Drop a pin instead" }).click();
      await wizard.getByLabel("District").selectOption("Nicosia");
      await typeAddress(page, savedAddress);
      await wizard.getByRole("button", { name: "Save this location" }).click();
      await expect(wizard.getByTestId("clinic-location-saved-summary")).toBeVisible();
      await expect(wizard.getByText(savedAddress)).toBeVisible();
      await expect(wizard.getByText(/District:\s*Nicosia/i)).toBeVisible();

      await page.getByRole("button", { name: /^Save settings$/i }).click();
      await expect(page.getByText(/Settings saved/i).first()).toBeVisible({ timeout: 20_000 });

      // 3) Public profile shows the real address — still never Evangelismos.
      await page.goto(`/en/${doctorSlug}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /^Location$/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(savedAddress)).toBeVisible();
      await expect(page.getByText(/Evangelismos/i)).toHaveCount(0);

      // 4) Re-open settings: wizard stays confirmed (address not “lost”).
      await page.goto("/agenda/settings", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("clinic-location-saved-summary")).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(savedAddress)).toBeVisible();
      await expect(
        page.getByRole("status").filter({ hasText: "Add your clinic address" }),
      ).toHaveCount(0);
    } finally {
      if (doctorId) {
        await admin.from("doctor_locations").delete().eq("doctor_id", doctorId);
        await admin.from("doctor_services").delete().eq("doctor_id", doctorId);
        await admin.from("doctor_settings").delete().eq("doctor_id", doctorId);
        await admin.from("professionals").delete().eq("id", doctorId);
      }
      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });

  test("legacy address without coords still shows in settings (Andreas-style)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "").trim() || "http://localhost:3000";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeLocalIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!supabaseUrl || !serviceRole, "Missing Supabase credentials.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const doctorEmail = `addr-legacy-${nonce}@integration.test`;
    const doctorPassword = "StrongPass123!";
    const doctorSlug = `addr-legacy-${nonce}`;
    const legacyAddress = "Vasileos Constantinou XIII 87, Pafos 8021";

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
        .from("professionals")
        .insert({
          auth_user_id: authUserId,
          name: `Legacy Address Doctor ${nonce}`,
          specialty: "Cardiology",
          district: "Paphos",
          town: "Paphos",
          clinic_address: legacyAddress,
          latitude: null,
          longitude: null,
          clinic_place_id: null,
          email: doctorEmail,
          phone: "+35799123456",
          languages: ["English"],
          license_number: `LIC-ADDR-LEG-${nonce}`,
          license_file_url: `licenses/integration/${nonce}-addr-legacy.pdf`,
          status: "verified",
          slug: doctorSlug,
          is_specialty_approved: true,
          is_registered: true,
          has_online_booking: true,
          finder_visible: true,
          is_archived: false,
          subscription_tier: "standard",
          trial_notice_seen_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (doctorInsert.error || !doctorInsert.data?.id) {
        throw new Error(`Failed creating doctor: ${doctorInsert.error?.message}`);
      }
      doctorId = String(doctorInsert.data.id);

      await signInDoctorAndSetCookies(page, undefined, {
        email: doctorEmail,
        password: doctorPassword,
      });
      await page.goto("/agenda/settings", { waitUntil: "domcontentloaded" });

      const wizard = page.getByTestId("settings-clinic-address-wizard");
      await expect(wizard.getByTestId("clinic-location-saved-summary")).toBeVisible({
        timeout: 20_000,
      });
      await expect(wizard.getByText(legacyAddress)).toBeVisible();
      await expect(wizard.getByText(/Saved address/i)).toBeVisible();
      await expect(wizard.getByRole("button", { name: "Add map pin" })).toBeVisible();
      await expect(wizard.getByPlaceholder(/Search your clinic on Google Maps/i)).toHaveCount(0);

      // Map sheet must show exit controls on Settings (not a trapped full-bleed map).
      await wizard.getByRole("button", { name: "Add map pin" }).click();
      await expect(wizard.getByRole("button", { name: "Adjust on map" })).toBeVisible({
        timeout: 10_000,
      });
      await wizard.getByRole("button", { name: "Adjust on map" }).click();
      await expectPinSheetChromeUsable(page);

      const sheet = page.getByTestId("clinic-pin-sheet");
      await sheet.getByRole("button", { name: "Cancel" }).click();
      await expect(sheet).toBeHidden();
      // Back on settings — wizard still usable, not stuck behind a locked body scroll.
      await expect(wizard.getByText(legacyAddress)).toBeVisible();
      await expect(page.getByRole("button", { name: /^Save settings$/i })).toBeVisible();
    } finally {
      if (doctorId) {
        await admin.from("doctor_locations").delete().eq("doctor_id", doctorId);
        await admin.from("doctor_services").delete().eq("doctor_id", doctorId);
        await admin.from("doctor_settings").delete().eq("doctor_id", doctorId);
        await admin.from("professionals").delete().eq("id", doctorId);
      }
      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});
