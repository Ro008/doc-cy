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

test.describe("Integration: finder user-like filter behavior matrix", () => {
  test("supports typical user filtering journeys without stale or broken states", async ({ page }) => {
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
        page.getByRole("heading", { level: 1, name: /Health Professionals in Cyprus/i })
      ).toBeVisible({ timeout: 20000 });

      const districtSelect = page.getByLabel("District");
      const specialtyInput = page.getByLabel("Specialty");
      const nameInput = page.getByLabel("Name");

      // Scenario 1: District-only exploration.
      await districtSelect.selectOption("Limassol");
      await expect(page).toHaveURL(/\/finder\/limassol(?:\?|$)/);
      await expect(page.getByRole("heading", { level: 1, name: /Health Professionals in Cyprus/i })).toBeVisible();
      await expect(page.getByText(created[0].name, { exact: true })).toBeVisible();
      await expect(page.getByText(created[1].name, { exact: true })).toBeVisible();
      await expect(page.getByText(created[2].name, { exact: true })).toHaveCount(0);

      // Scenario 2: District + specialty narrowing.
      await specialtyInput.fill("Dentistry");
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/\/finder\/limassol\/dentistry(?:\?|$)/);
      await expect(page.getByRole("heading", { level: 1, name: /Dentistry in Limassol/i })).toBeVisible();
      await expect(page.getByText(created[1].name, { exact: true })).toBeVisible();
      await expect(page.getByText(created[0].name, { exact: true })).toHaveCount(0);

      // Scenario 3: Name search after existing filters.
      await nameInput.fill("Dent");
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/name=Dent/);
      await expect(page.getByText(created[1].name, { exact: true })).toBeVisible();

      // Scenario 4: Reset should recover broad list + clean path.
      await page.getByRole("button", { name: /Clear all filters|Reset/i }).click();
      await expect(page).toHaveURL(/\/finder(?:\?|$)/);
      await expect(
        page.getByRole("heading", { level: 1, name: /Health Professionals in Cyprus/i })
      ).toBeVisible();
      await expect(page.getByText(created[0].name, { exact: true })).toBeVisible();
      await expect(page.getByText(created[1].name, { exact: true })).toBeVisible();
      await expect(page.getByText(created[2].name, { exact: true })).toBeVisible();
    } finally {
      for (const doctor of created) {
        await admin.from("doctors").delete().eq("id", doctor.doctorId);
        await admin.auth.admin.deleteUser(doctor.authUserId);
      }
    }
  });
});

