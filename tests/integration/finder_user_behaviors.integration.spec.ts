import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { finderIncludesRegisteredTestProfiles } from "@/lib/doctor-test-profile";
import { selectFinderSpecialty } from "./helpers/finder-specialty-combobox";

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

function registeredDoctorLink(page: import("@playwright/test").Page, name: string) {
  return page.getByRole("link", { name, exact: true });
}

/**
 * Account-lane claim leftovers also pin as test profiles on page 1 (12 cards).
 * Assert via the name filter so seeded doctors are not crowded off the first page.
 */
async function expectRegisteredDoctorViaNameFilter(
  page: import("@playwright/test").Page,
  name: string,
  options?: { absent?: boolean },
) {
  const nameInput = page.locator("#finder-name-filter");
  const showResults = page.getByRole("button", { name: /^Find$/i });
  await nameInput.fill(name);
  await showResults.click();
  await expect(page).toHaveURL(/name=/, { timeout: 60_000 });
  if (options?.absent) {
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  } else {
    await expect(registeredDoctorLink(page, name)).toBeVisible({ timeout: 60_000 });
  }
}

async function clearFinderNameFilter(page: import("@playwright/test").Page) {
  const nameInput = page.locator("#finder-name-filter");
  const showResults = page.getByRole("button", { name: /^Find$/i });
  await nameInput.fill("");
  await showResults.click();
  await expect(page).not.toHaveURL(/name=/, { timeout: 60_000 });
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
    .from("professionals")
    .insert({
      auth_user_id: authUserId,
      name: input.name,
      district: input.district,
      email,
      phone: "+35799123456",
      languages: input.languages,
      license_file_url: `licenses/integration/${nonce}-${input.slugPrefix}.pdf`,
      status: "verified",
      slug,
      // Mark as test so cleanup + prod finder hide are reliable; still visible when
      // NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES=1 (integration).
      is_test_profile: true,
            is_registered: true,
      has_online_booking: true,
      finder_visible: true,
      is_archived: false,
      subscription_tier: "standard",

    })
    .select("id")
    .single();

  if (doctorInsert.error || !doctorInsert.data?.id) {
    await admin.auth.admin.deleteUser(authUserId);
    throw new Error(`Failed creating doctor row: ${doctorInsert.error?.message}`);
  }

  const doctorId = String(doctorInsert.data.id);
  const specialtyInsert = await admin.from("professional_specialties").insert(
    {
      professional_id: doctorId,
      specialty: input.specialty,
      license_number: `LIC-FINDER-UX-${nonce}-${input.slugPrefix}`,
      is_approved: true,
    },
  );
  if (specialtyInsert.error) {
    await admin.from("professionals").delete().eq("id", doctorId);
    await admin.auth.admin.deleteUser(authUserId);
    throw new Error(
      `Failed creating professional_specialties: ${specialtyInsert.error.message}`,
    );
  }

  return {
    doctorId,
    authUserId,
    slug,
    name: input.name,
    district: input.district,
    specialty: input.specialty,
  };
}

test.describe("Integration: finder user-like filter behavior matrix", { tag: ["@pr-e2e", "@pr-e2e-finder"] }, () => {
  test("supports typical user filtering journeys without stale or broken states", async ({ page }) => {
    // Full unfiltered finder now loads the entire directory (no 600-row cap).
    test.setTimeout(120_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const unsafeReason = assertSafeIntegrationTarget(baseUrl, supabaseUrl);
    test.skip(Boolean(unsafeReason), unsafeReason ?? undefined);
    test.skip(!baseUrl || !supabaseUrl || !serviceRole, "Missing integration env vars.");
    test.skip(
      !finderIncludesRegisteredTestProfiles(),
      "NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES is not enabled.",
    );

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const created: CreatedDoctor[] = [];

    try {
      created.push(
        await createVerifiedDoctor(admin, `${nonce}-a`, {
          slugPrefix: "finder-ux-limassol-derm",
          name: `Finder UX Limassol Derm ${nonce}`,
          specialty: "Dermatology",
          district: "Limassol",
          languages: ["English"],
        })
      );
      created.push(
        await createVerifiedDoctor(admin, `${nonce}-b`, {
          slugPrefix: "finder-ux-limassol-dent",
          name: `Finder UX Limassol Dent ${nonce}`,
          specialty: "Dentistry",
          district: "Limassol",
          languages: ["Greek"],
        })
      );
      created.push(
        await createVerifiedDoctor(admin, `${nonce}-c`, {
          slugPrefix: "finder-ux-paphos-dent",
          name: `Finder UX Paphos Dent ${nonce}`,
          specialty: "Dentistry",
          district: "Paphos",
          languages: ["English", "Greek"],
        })
      );

      await page.goto("/");
      await expect(
        page.getByRole("heading", { level: 1, name: /The most complete health directory in Cyprus|Cyprus['’]s most complete health directory|Find your next health professional/i })
      ).toBeVisible({ timeout: 60_000 });

      const districtSelect = page.getByLabel("District");
      const specialtySelect = page.getByTestId("finder-specialty-trigger");
      const nameInput = page.locator("#finder-name-filter");
      const showResults = page.getByRole("button", { name: /^Find$/i });

      // Scenario 1: District-only exploration (apply once).
      await districtSelect.selectOption("Limassol");
      await expect(page).toHaveURL(/^https?:\/\/[^/?#]+\/?(?:\?.*)?$/, { timeout: 60_000 });
      await showResults.click();
      await expect(page).toHaveURL(/\/limassol(?:\?|$)/, { timeout: 60_000 });
      await expect(page.getByTestId("finder-active-filters")).toContainText("Limassol", {
        timeout: 60_000,
      });
      await expect(
        page.getByRole("heading", { level: 1, name: /Health professionals in Limassol/i }),
      ).toBeVisible({ timeout: 60_000 });
      await expectRegisteredDoctorViaNameFilter(page, created[0].name);
      await expectRegisteredDoctorViaNameFilter(page, created[1].name);
      await expectRegisteredDoctorViaNameFilter(page, created[2].name, { absent: true });
      await clearFinderNameFilter(page);

      // Scenario 2: District + specialty narrowing.
      await selectFinderSpecialty(page, "dentist");
      await expect(specialtySelect).toHaveText("Dentist");
      await showResults.click();
      await expect(page).toHaveURL(/\/limassol\/dentist(?:\?|$)/, { timeout: 60_000 });
      await expect(
        page.getByRole("heading", { level: 1, name: /Dentist in Limassol/i }),
      ).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByTestId("finder-active-filters")).toContainText("Dentist", {
        timeout: 60_000,
      });
      await expectRegisteredDoctorViaNameFilter(page, created[1].name);
      await expectRegisteredDoctorViaNameFilter(page, created[0].name, { absent: true });
      await clearFinderNameFilter(page);

      // Scenario 3: Name filter applies on Enter or Find (not while typing).
      await nameInput.fill("Dent");
      await expect(page).not.toHaveURL(/name=/, { timeout: 5_000 });
      await nameInput.press("Enter");
      await expect(page).toHaveURL(/name=Dent/, { timeout: 60_000 });
      await expect(page.getByTestId("finder-active-filters")).toContainText("Dent", {
        timeout: 60_000,
      });
      await expect(registeredDoctorLink(page, created[1].name)).toBeVisible({ timeout: 60_000 });

      // Scenario 4: Reset should recover broad list + clean path.
      await page.getByRole("button", { name: /^Clear$/i }).click();
      await expect(page).toHaveURL(/^https?:\/\/[^/?#]+\/?(?:\?.*)?$/, { timeout: 60_000 });
      await expect(page.getByTestId("finder-active-filters")).toHaveCount(0);
      await expect(
        page.getByRole("heading", { level: 1, name: /The most complete health directory in Cyprus|Cyprus['’]s most complete health directory|Find your next health professional/i })
      ).toBeVisible({ timeout: 60_000 });
      await expectRegisteredDoctorViaNameFilter(page, created[0].name);
      await expectRegisteredDoctorViaNameFilter(page, created[1].name);
      await expectRegisteredDoctorViaNameFilter(page, created[2].name);
    } finally {
      for (const doctor of created) {
        await admin.from("professionals").delete().eq("id", doctor.doctorId);
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

    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /The most complete health directory in Cyprus|Cyprus['’]s most complete health directory|Find your next health professional/i }),
    ).toBeVisible({ timeout: 20_000 });

    const specialtySelect = page.getByTestId("finder-specialty-trigger");
    await selectFinderSpecialty(page, "otorhinolaryngology");
    await expect(specialtySelect).toHaveText("Otorhinolaryngology");

    await page.getByRole("button", { name: /Doctor near me/i }).click();
    await expect(page).toHaveURL(/\/all\/otorhinolaryngology(?:\?|$)/, { timeout: 20_000 });
    await expect(page).toHaveURL(/[?&]lat=/, { timeout: 20_000 });
    await expect(page).toHaveURL(/[?&]lon=/, { timeout: 20_000 });
    await expect(page.getByTestId("finder-active-filters")).toContainText("Near me", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("finder-active-filters")).toContainText("Otorhinolaryngology");

    await page.getByRole("button", { name: /^Clear$/i }).click();
    await expect(page).toHaveURL(/^https?:\/\/[^/?#]+\/?(?:\?.*)?$/, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/[?&]lat=/, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/[?&]lon=/, { timeout: 20_000 });
    await expect(page.getByTestId("finder-active-filters")).toHaveCount(0);
  });
});

