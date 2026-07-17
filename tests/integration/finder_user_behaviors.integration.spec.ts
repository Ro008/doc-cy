import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

type CreatedDoctor = {
  doctorId: string;
  authUserId: string;
  slug: string;
  name: string;
  district: "Nicosia" | "Limassol" | "Paphos" | "Larnaca" | "Famagusta";
  specialty: string;
};

function normalizeUrl(u: string): string {
  return u.replace(/\/+$/, "");
}

function assertSafeIntegrationTarget(baseUrl: string, supabaseUrl: string): string | null {
  const safeEnv = process.env.INTEGRATION_SAFE_ENV === "1";
  const prodSupabase = normalizeUrl(process.env.PROD_NEXT_PUBLIC_SUPABASE_URL ?? "");
  const integrationSupabase = normalizeUrl(supabaseUrl);
  const usingProductionSupabase = prodSupabase.length > 0 && integrationSupabase === prodSupabase;
  const unsafeBase = /mydoccy\.com/i.test(baseUrl);
  if (!safeEnv || unsafeBase || usingProductionSupabase) {
    return "Unsafe target or missing INTEGRATION_SAFE_ENV.";
  }
  return null;
}

async function createVerifiedDoctor(
  admin: ReturnType<typeof createClient>,
  nonce: string,
  input: {
    slugPrefix: string;
    name: string;
    specialty: string;
    district: "Nicosia" | "Limassol" | "Paphos" | "Larnaca" | "Famagusta";
    languages: string[];
  }
): Promise<CreatedDoctor> {
  // Keep cleanup-compatible suffix while avoiding finder anti-test filters.
  const email = `${input.slugPrefix}-${nonce}@test-doccy.com.cy`;
  const slug = `${input.slugPrefix}-${nonce}`;
  const userRes = await admin.auth.admin.createUser({
    email,
    password: "StrongPass123!",
    email_confirm: true,
    user_metadata: { role: "doctor" },
  });
  if (userRes.error || !userRes.data.user?.id) {
    throw new Error(`Failed creating auth user: ${userRes.error?.message}`);
  }
  const authUserId = userRes.data.user.id;

  const doctorInsert = await admin
    .from("doctors")
    .insert({
      auth_user_id: authUserId,
      name: input.name,
      specialty: input.specialty,
      district: input.district,
      email,
      phone: "+35799123456",
      languages: input.languages,
      license_number: `LIC-FINDER-UX-${nonce}-${input.slugPrefix}`,
      license_file_url: `licenses/integration/${nonce}-${input.slugPrefix}.pdf`,
      status: "verified",
      slug,
      is_specialty_approved: true,
      // Must stay visible in finder for user-behavior assertions.
      is_test_profile: false,
      subscription_tier: "standard",
    })
    .select("id")
    .single();

  if (doctorInsert.error || !doctorInsert.data?.id) {
    await admin.auth.admin.deleteUser(authUserId);
    throw new Error(`Failed creating doctor row: ${doctorInsert.error?.message}`);
  }

  return {
    doctorId: String(doctorInsert.data.id),
    authUserId,
    slug,
    name: input.name,
    district: input.district,
    specialty: input.specialty,
  };
}

test.describe("Integration: finder user-like filter behavior matrix", { tag: "@pr-e2e" }, () => {
  test("supports typical user filtering journeys without stale or broken states", async ({ page }) => {
    // Full unfiltered finder now loads the entire directory (no 600-row cap).
    test.setTimeout(120_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!baseUrl || !supabaseUrl || !serviceRole, "Missing integration env vars.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const created: CreatedDoctor[] = [];

    try {
      created.push(
        await createVerifiedDoctor(admin, `${nonce}-a`, {
          slugPrefix: "qa-ux-limassol-derm",
          name: `Finder UX Limassol Derm ${nonce}`,
          specialty: "Dermatology",
          district: "Limassol",
          languages: ["English"],
        })
      );
      created.push(
        await createVerifiedDoctor(admin, `${nonce}-b`, {
          slugPrefix: "qa-ux-limassol-dent",
          name: `Finder UX Limassol Dent ${nonce}`,
          specialty: "Dentistry",
          district: "Limassol",
          languages: ["Greek"],
        })
      );
      created.push(
        await createVerifiedDoctor(admin, `${nonce}-c`, {
          slugPrefix: "qa-ux-paphos-dent",
          name: `Finder UX Paphos Dent ${nonce}`,
          specialty: "Dentistry",
          district: "Paphos",
          languages: ["English", "Greek"],
        })
      );

      await page.goto("/finder");
      await expect(
        page.getByRole("heading", { level: 1, name: /Find your next health professional in Cyprus/i })
      ).toBeVisible({ timeout: 60_000 });

      const districtSelect = page.getByLabel("District");
      const specialtySelect = page.getByLabel("Specialty");
      const nameInput = page.locator("#finder-name-filter");
      const showResults = page.getByRole("button", { name: /^Show results$/i });

      // Scenario 1: District-only exploration (apply once).
      await districtSelect.selectOption("Limassol");
      await expect(page).toHaveURL(/\/finder(?:\?|$)/, { timeout: 60_000 });
      await showResults.click();
      await expect(page).toHaveURL(/\/finder\/limassol(?:\?|$)/, { timeout: 60_000 });
      await expect(page.getByText("District: Limassol", { exact: false })).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByRole("heading", { level: 1, name: /Find your next health professional in Cyprus/i })).toBeVisible();
      await expect(page.getByText(created[0].name, { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(created[1].name, { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(created[2].name, { exact: true })).toHaveCount(0);

      // Scenario 2: District + specialty narrowing.
      await expect(specialtySelect).toBeEnabled({ timeout: 30_000 });
      await expect(specialtySelect.locator('option[value="dentistry"]')).toHaveCount(1, {
        timeout: 60_000,
      });
      await specialtySelect.selectOption("dentistry");
      await showResults.click();
      await expect(page).toHaveURL(/\/finder\/limassol\/dentistry(?:\?|$)/, { timeout: 60_000 });
      await expect(page.getByRole("heading", { level: 1, name: /Dentistry in Limassol/i })).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText("Specialty: Dentistry", { exact: false })).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText(created[1].name, { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(created[0].name, { exact: true })).toHaveCount(0);

      // Scenario 3: Name filter applies on Enter or Show results (not while typing).
      await nameInput.fill("Dent");
      await expect(page).not.toHaveURL(/name=/, { timeout: 5_000 });
      await expect(page.getByText(created[1].name, { exact: true })).toBeVisible({ timeout: 60_000 });
      await nameInput.press("Enter");
      await expect(page).toHaveURL(/name=Dent/, { timeout: 60_000 });
      await expect(page.getByText("Name: Dent", { exact: false })).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText(created[1].name, { exact: true })).toBeVisible({ timeout: 60_000 });

      // Scenario 4: Reset should recover broad list + clean path.
      await page.getByRole("button", { name: /Clear all filters|Reset/i }).click();
      await expect(page).toHaveURL(/\/finder(?:\?|$)/, { timeout: 60_000 });
      await expect(page.getByRole("button", { name: /Clear all filters/i })).toBeHidden({
        timeout: 60_000,
      });
      await expect(page.getByText("District: Limassol", { exact: false })).toBeHidden();
      await expect(page.getByText("Specialty: Dentistry", { exact: false })).toBeHidden();
      await expect(page.getByText("Name: Dent", { exact: false })).toBeHidden();
      await expect(
        page.getByRole("heading", { level: 1, name: /Find your next health professional in Cyprus/i })
      ).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(created[0].name, { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(created[1].name, { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(created[2].name, { exact: true })).toBeVisible({ timeout: 60_000 });
    } finally {
      for (const doctor of created) {
        await admin.from("doctors").delete().eq("id", doctor.doctorId);
        await admin.auth.admin.deleteUser(doctor.authUserId);
      }
    }
  });

  test("keeps specialty filter when using Doctor near me", async ({ page, context }) => {
    test.setTimeout(120_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!baseUrl || !supabaseUrl || !serviceRole, "Missing integration env vars.");

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 34.7071, longitude: 33.0226 });

    await page.goto("/finder");
    await expect(
      page.getByRole("heading", { level: 1, name: /Find your next health professional in Cyprus/i }),
    ).toBeVisible({ timeout: 20_000 });

    const specialtySelect = page.getByLabel("Specialty");
    await expect(specialtySelect.locator('option[value="ent"]')).toHaveCount(1, {
      timeout: 20_000,
    });
    await specialtySelect.selectOption("ent");

    await page.getByRole("button", { name: /Doctor near me/i }).click();
    await expect(page).toHaveURL(/\/finder\/all\/ent(?:\?|$)/, { timeout: 20_000 });
    await expect(page).toHaveURL(/[?&]lat=/, { timeout: 20_000 });
    await expect(page).toHaveURL(/[?&]lon=/, { timeout: 20_000 });
    await expect(page.getByText("Near me: enabled")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Specialty: ENT", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: /Clear all filters/i }).click();
    await expect(page).toHaveURL(/\/finder(?:\?|$)/, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/[?&]lat=/, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/[?&]lon=/, { timeout: 20_000 });
    await expect(page.getByText("Near me: enabled")).toBeHidden();
    await expect(page.getByText("Specialty: ENT", { exact: false })).toBeHidden();
    await expect(page.getByRole("button", { name: /Clear all filters/i })).toBeHidden();
  });
});

